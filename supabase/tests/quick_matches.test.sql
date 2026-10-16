-- Preguntas, importación y RPC del modo rápido. Se ejecuta con `pnpm db:test`; todo se deshace al final.
begin;
select plan(37);

-- Fixtures (como postgres) -------------------------------------------------------------------------
-- Las preguntas que ya hubiera (p. ej. el seed local) se retiran para que el test no dependa del contenido.
update public.questions set status = 'rejected';
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@test.local');
insert into public.profiles (id, username, avatar_id, locale) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'axolotl-pink', 'es'),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'axolotl-gold', 'es');
-- carol no tiene perfil (onboarding sin completar).

create function pg_temp.question(ext text, status text, locale text) returns jsonb language sql as $$
  select jsonb_build_object(
    'externalId', ext, 'category', 'geography', 'difficulty', 'easy', 'status', status, 'source', 'manual',
    'translations', jsonb_build_object(locale, jsonb_build_object(
      'prompt', 'Pregunta ' || ext, 'correct', 'Bien', 'wrong', jsonb_build_array('Mal 1', 'Mal 2', 'Mal 3'))))
$$;

-- 14 jugables en español (justo 2 jugadores × 7), más borradores y preguntas solo en inglés que nunca deben salir.
select is(
  public.import_questions((
    select jsonb_agg(pg_temp.question('t-es-' || i, 'approved', 'es')) from generate_series(1, 14) as i
  ) || (
    select jsonb_agg(pg_temp.question('t-draft-' || i, 'draft', 'es')) from generate_series(1, 5) as i
  ) || (
    select jsonb_agg(pg_temp.question('t-en-' || i, 'approved', 'en')) from generate_series(1, 5) as i
  )),
  24, 'import_questions importa el lote'
);

-- Importación ----------------------------------------------------------------------------------------
select is(
  public.import_questions(jsonb_build_array(pg_temp.question('t-draft-1', 'draft', 'es'))),
  1, 'reimportar el mismo externalId...'
);
select is(
  (select count(*)::integer from public.questions where external_id like 't-%'), 24, '...no duplica la pregunta'
);
select throws_like(
  $$ select public.import_questions('[{"externalId":"t-bad","category":"geography","difficulty":"easy","source":"manual",
       "translations":{"es":{"prompt":"¿?","correct":"Sí","wrong":["sí"]}}}]') $$,
  '%respuestas repetidas%', 'rechaza respuestas repetidas'
);
select throws_like(
  $$ select public.import_questions('[{"externalId":"t-bad","category":"nope","difficulty":"easy","source":"manual",
       "translations":{"es":{"prompt":"¿?","correct":"Sí","wrong":["No"]}}}]') $$,
  '%pregunta t-bad%', 'rechaza una categoría inexistente indicando la pregunta'
);
select is(
  (select answers[1] from public.question_translations t join public.questions q on q.id = t.question_id
   where q.external_id = 't-es-1'),
  'Bien', 'la respuesta correcta se guarda la primera'
);

-- Puntuación: 10 por acierto, +5 en menos de 3 s, si no +2 en menos de la mitad del tiempo (7,5 s).
select is(
  array[
    public.answer_points(true, 2999, 15000), public.answer_points(true, 3000, 15000),
    public.answer_points(true, 7499, 15000), public.answer_points(true, 7500, 15000),
    public.answer_points(false, 100, 15000)
  ],
  array[15, 12, 12, 10, 0], 'tramos de bonificación por rapidez'
);

-- Acceso directo prohibido ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok('select * from public.questions', '42501', null, 'el cliente no lee preguntas');
select throws_ok('select * from public.question_translations', '42501', null, 'el cliente no lee respuestas');
select throws_ok('select * from public.quick_match_rounds', '42501', null, 'el cliente no lee rondas');
select throws_ok($$ select public.import_questions('[]') $$, '42501', null, 'el cliente no importa');

-- Partida en solitario -------------------------------------------------------------------------------
select throws_like(
  $$ select public.start_quick_match('hard') $$, 'no hay suficientes preguntas', 'sin preguntas de esa dificultad no empieza'
);
select lives_ok(
  $$ select set_config('test.solo', public.start_quick_match('easy')::text, true) $$, 'alice empieza una partida en solitario'
);
select is(
  (public.get_quick_match(current_setting('test.solo')::uuid) ->> 'total')::integer, 7, '7 preguntas en solitario'
);

select set_config('test.q', public.serve_quick_question(current_setting('test.solo')::uuid)::text, true);
select is(
  (select array_agg(k order by k) from jsonb_object_keys(current_setting('test.q')::jsonb) as k),
  array['answers', 'category', 'elapsedMs', 'position', 'prompt', 'seat', 'timeLimitMs'],
  'la pregunta servida no incluye la correcta'
);
select is(jsonb_array_length(current_setting('test.q')::jsonb -> 'answers'), 4, 'sirve las 4 respuestas');
select is(
  current_setting('test.q')::jsonb -> 'category' ->> 'name', 'Geografía', 'categoría en el idioma del perfil'
);
select is(
  public.serve_quick_question(current_setting('test.solo')::uuid) ->> 'position', '0',
  'volver a pedir la pregunta devuelve la misma'
);
select throws_like(
  $$ select public.answer_quick_question(current_setting('test.solo')::uuid, 1, 0) $$,
  'pregunta no disponible', 'no se puede responder una pregunta no servida'
);
select throws_like(
  $$ select public.answer_quick_question(current_setting('test.solo')::uuid, 0, 4) $$,
  'respuesta no válida', 'rechaza un índice de respuesta fuera de rango'
);

-- Para saber cuál es la correcta hay que mirar como postgres.
reset role;
select set_config('test.correct', (
  select (array_position(answer_order, 1::smallint) - 1)::text from public.quick_match_rounds
  where match_id = current_setting('test.solo')::uuid and position = 0
), true);
set local role authenticated;

select set_config('test.a', public.answer_quick_question(
  current_setting('test.solo')::uuid, 0, current_setting('test.correct')::integer)::text, true);
select ok(
  (current_setting('test.a')::jsonb ->> 'isCorrect')::boolean
    and (current_setting('test.a')::jsonb ->> 'points')::integer = 15
    and current_setting('test.a')::jsonb ->> 'correctIndex' = current_setting('test.correct'),
  'acierto en menos de 3 s: 15 puntos y revela la correcta'
);
select throws_like(
  $$ select public.answer_quick_question(current_setting('test.solo')::uuid, 0, 0) $$,
  'pregunta no disponible', 'no se puede responder dos veces'
);

-- Pregunta 2: tiempo agotado.
select public.serve_quick_question(current_setting('test.solo')::uuid);
select is(
  public.answer_quick_question(current_setting('test.solo')::uuid, 1, null) ->> 'points', '0', 'tiempo agotado = 0'
);

-- Pregunta 3: respuesta correcta pero fuera de plazo (más de 15 s + margen).
select public.serve_quick_question(current_setting('test.solo')::uuid);
reset role;
update public.quick_match_rounds set served_at = clock_timestamp() - interval '18 seconds'
where match_id = current_setting('test.solo')::uuid and position = 2;
select set_config('test.correct', (
  select (array_position(answer_order, 1::smallint) - 1)::text from public.quick_match_rounds
  where match_id = current_setting('test.solo')::uuid and position = 2
), true);
set local role authenticated;
select is(
  public.answer_quick_question(current_setting('test.solo')::uuid, 2, current_setting('test.correct')::integer)
    ->> 'isCorrect',
  'false', 'una respuesta fuera de plazo no cuenta'
);

-- Resto de preguntas: siempre la opción 0 (puede acertar o no).
select public.serve_quick_question(current_setting('test.solo')::uuid),
       public.answer_quick_question(current_setting('test.solo')::uuid, p, 0)
from generate_series(3, 6) as p;
select is(
  public.get_quick_match(current_setting('test.solo')::uuid) -> 'nextPosition', 'null'::jsonb,
  'tras 7 respuestas la partida termina'
);
select throws_like(
  $$ select public.serve_quick_question(current_setting('test.solo')::uuid) $$,
  'partida terminada', 'una partida terminada no sirve más preguntas'
);

reset role;
select is(
  (public.get_quick_match(current_setting('test.solo')::uuid) -> 'players' -> 0 ->> 'score')::integer,
  (select sum(points)::integer from public.quick_match_rounds where match_id = current_setting('test.solo')::uuid),
  'la puntuación del jugador es la suma de sus rondas'
);
select ok(
  (select finished_at is not null from public.quick_matches where id = current_setting('test.solo')::uuid),
  'la partida queda marcada como terminada'
);
select is(
  (select count(*)::integer from public.quick_match_rounds r join public.questions q on q.id = r.question_id
   where r.match_id = current_setting('test.solo')::uuid and (q.status <> 'approved' or q.external_id like 't-en-%')),
  0, 'solo salen preguntas aprobadas en el idioma de la partida'
);

-- Preguntas ya vistas: las dos siguientes partidas (sin jugar) usan las 7 que alice aún no ha visto.
-- Si contaran las asignadas sin servir, la tercera repetiría las de la primera partida.
set local role authenticated;
select set_config('test.solo2', public.start_quick_match('easy')::text, true);
select set_config('test.solo3', public.start_quick_match('easy')::text, true);
reset role;
select is(
  (select count(*)::integer from public.quick_match_rounds as a
   join public.quick_match_rounds as b on b.question_id = a.question_id
   where a.match_id = current_setting('test.solo')::uuid
     and b.match_id in (current_setting('test.solo2')::uuid, current_setting('test.solo3')::uuid)),
  0, 'se evitan las preguntas ya vistas y no cuentan las que no se sirvieron'
);

-- Partida local con invitado -------------------------------------------------------------------------
set local role authenticated;
select set_config('test.guest', (public.remember_guest('Lucía', 'axolotl-mint')).id::text, true);
select set_config('test.duo', public.start_quick_match('easy', array[current_setting('test.guest')::uuid])::text, true);
select is(
  (select jsonb_agg(p ->> 'name') from jsonb_array_elements(
     public.get_quick_match(current_setting('test.duo')::uuid) -> 'players') as p),
  '["alice", "Lucía"]'::jsonb, 'anfitrión en el asiento 0 y el invitado después'
);
select public.serve_quick_question(current_setting('test.duo')::uuid);
select public.answer_quick_question(current_setting('test.duo')::uuid, 0, null);
select is(
  public.serve_quick_question(current_setting('test.duo')::uuid) ->> 'seat', '1', 'los turnos se alternan'
);
select throws_like(
  $$ select public.start_quick_match('easy', array[current_setting('test.guest')::uuid, current_setting('test.guest')::uuid]) $$,
  'invitados no válidos', 'no se puede repetir un invitado'
);

-- Otros usuarios -------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(public.get_quick_match(current_setting('test.duo')::uuid), null, 'bob no ve la partida de alice');
select throws_like(
  $$ select public.serve_quick_question(current_setting('test.duo')::uuid) $$,
  'partida no encontrada', 'bob no puede jugar la partida de alice'
);
select throws_like(
  $$ select public.start_quick_match('easy', array[current_setting('test.guest')::uuid]) $$,
  'invitados no válidos', 'bob no puede usar los invitados de alice'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_like(
  $$ select public.start_quick_match('easy') $$, 'perfil no creado', 'sin perfil no se puede jugar'
);

select * from finish();
rollback;

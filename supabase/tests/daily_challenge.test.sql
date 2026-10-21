-- Reto diario. Se ejecuta con `pnpm db:test`; todo se deshace al final.
begin;
select plan(17);

-- Fixtures (como postgres) -------------------------------------------------------------------------
update public.questions set status = 'rejected';
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@test.local');
insert into public.profiles (id, username, avatar_id, locale, terms_version) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'axolotl-pink', 'es', 1),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'axolotl-gold', 'en', 1),
  ('00000000-0000-0000-0000-00000000000c', 'carol', 'axolotl-gold', 'es', 1);
insert into public.friendships (requester_id, addressee_id, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted');

-- Dos preguntas (a y b) por categoría y dificultad, en es y en; y una solo en es que nunca debe salir.
select public.import_questions((
  select jsonb_agg(jsonb_build_object(
    'externalId', format('d-%s-%s-%s', c.id, d, v), 'category', c.id, 'difficulty', d,
    'status', 'approved', 'source', 'manual',
    'translations', jsonb_build_object(
      'es', jsonb_build_object('prompt', '¿?', 'correct', 'Sí', 'wrong', jsonb_build_array('No')),
      'en', jsonb_build_object('prompt', '?', 'correct', 'Yes', 'wrong', jsonb_build_array('No')))))
  from public.categories as c, unnest(array['easy', 'medium', 'hard']) as d, unnest(array['a', 'b']) as v
));
select public.import_questions(jsonb_build_array(jsonb_build_object(
  'externalId', 'd-solo-es', 'category', 'geography', 'difficulty', 'easy', 'status', 'approved', 'source', 'manual',
  'translations', jsonb_build_object('es', jsonb_build_object('prompt', '¿?', 'correct', 'Sí', 'wrong', jsonb_build_array('No'))))));
update public.questions set created_at = now() - interval '1 day' where external_id = 'd-solo-es';

-- Ayer hubo reto (el #1) con las "a" de dificultad normal: hoy no deben repetirse.
insert into public.daily_challenges (day, number, question_ids)
select public.daily_today() - 1, 1, array_agg(q.id)
from public.questions as q where q.external_id like 'd-%-medium-a';

create function pg_temp.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true);
  select null::void;
$$;
-- Juega las 7 preguntas del reto eligiendo siempre la primera respuesta en pantalla.
create function pg_temp.play_all(match uuid) returns void language plpgsql as $$
begin
  for i in 0 .. 6 loop
    perform public.serve_quick_question(match);
    perform public.answer_quick_question(match, i, 0);
  end loop;
end;
$$;

-- El reto de hoy -----------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select is(public.get_daily(), '{"number": 2, "match": null, "friends": []}'::jsonb,
  'sin empezar: número del reto (cuenta desde el primero) y sin partida');

reset role;
create function pg_temp.today_questions() returns table (ord bigint, category_id text, difficulty text, external_id text)
language sql as $$
  select o.ord, q.category_id, q.difficulty, q.external_id
  from unnest((select question_ids from public.daily_challenges where day = public.daily_today()))
    with ordinality as o (id, ord)
  join public.questions as q on q.id = o.id
$$;
select set_config('test.first_name', (select ct.name from pg_temp.today_questions() as q
  join public.category_translations as ct on ct.category_id = q.category_id and ct.locale = 'es' where q.ord = 1), true);
select is((select count(distinct category_id) from pg_temp.today_questions()), 7::bigint, 'una pregunta de cada categoría');
select is((select array_agg(difficulty order by ord) from pg_temp.today_questions()),
  array['easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard'], 'de fácil a difícil (2 + 3 + 2)');
select ok((select bool_and(external_id not like '%-medium-a' and external_id <> 'd-solo-es') from pg_temp.today_questions()),
  'ni preguntas del reto de ayer ni sin traducir a todos los idiomas');

-- Jugarlo --------------------------------------------------------------------------------------------
set local role authenticated;
select set_config('test.alice', public.start_daily_match()::text, true);
select is(public.start_daily_match()::text, current_setting('test.alice'), 'un solo intento: se retoma la misma partida');
select is(public.get_daily() #>> '{match,finished}', 'false', 'empezado y sin terminar');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select set_config('test.bob', public.start_daily_match()::text, true);
reset role;
select is(
  (select array_agg(question_id order by position) from public.quick_match_rounds
   where match_id = current_setting('test.bob')::uuid),
  (select array_agg(question_id order by position) from public.quick_match_rounds
   where match_id = current_setting('test.alice')::uuid),
  'las mismas preguntas y en el mismo orden para todos');

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.play_all(current_setting('test.alice')::uuid);
select is(jsonb_array_length(public.get_daily() #> '{match,rounds}'), 7, 'al terminar: los 7 cuadritos');
select is((public.get_daily() #> '{match,rounds,0}') - 'correct' - 'categoryId' - 'color',
  jsonb_build_object('name', current_setting('test.first_name')),
  'cada cuadrito con el nombre de su categoría en el idioma de quien mira');
select ok(public.get_daily() #>> '{match,finished}' = 'true' and public.get_daily() #> '{match,xp}' <> 'null',
  'terminado y con XP como una rápida');
select is(public.get_daily() -> 'friends', '[]'::jsonb, 'los amigos que no han terminado no salen');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select is(public.get_daily() -> 'friends', '[]'::jsonb, 'quien no ha terminado aún no ve a sus amigos');
select pg_temp.play_all(current_setting('test.bob')::uuid);
select is(public.get_daily() #>> '{friends,0,username}', 'alice', 'al terminar ve a sus amigos que ya lo han jugado');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.start_daily_match();
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select is(jsonb_array_length(public.get_daily() -> 'friends'), 1, 'quien no es amigo no sale');

-- Días pasados -------------------------------------------------------------------------------------
reset role;
insert into public.quick_matches (id, owner_id, locale, player_count, daily_day)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000c', 'es', 1, public.daily_today() - 1);
insert into public.quick_match_rounds (match_id, position, question_id, answer_order)
select '00000000-0000-0000-0000-0000000000f1', 0, id, '{1,2}' from public.questions where external_id = 'd-geography-easy-a';
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select throws_like($$ select public.serve_quick_question('00000000-0000-0000-0000-0000000000f1') $$,
  'reto caducado', 'el reto de ayer sin terminar ya no se puede seguir');

reset role;
select throws_ok($$
  insert into public.quick_matches (owner_id, locale, difficulty, player_count, daily_day)
  values ('00000000-0000-0000-0000-00000000000c', 'es', 'easy', 1, public.daily_today() - 1)
$$, '23514', null, 'un reto no tiene dificultad');
set local role authenticated;
select throws_ok($$ select * from public.daily_challenges $$, '42501', null, 'el cliente no lee los retos');

select * from finish();
rollback;

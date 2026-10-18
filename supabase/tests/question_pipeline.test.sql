-- Actualidad, caducidad, exportación y revisión de preguntas. Se ejecuta con `pnpm db:test`; todo se deshace al final.
begin;
select plan(17);

-- Fixtures (como postgres) -------------------------------------------------------------------------
update public.questions set status = 'rejected';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'alice@test.local');
insert into public.profiles (id, username, avatar_id, locale)
values ('00000000-0000-0000-0000-00000000000a', 'alice', 'axolotl-pink', 'es');

create function pg_temp.question(ext text, extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'externalId', ext, 'category', 'geography', 'difficulty', 'easy', 'status', 'approved', 'source', 'ai',
    'translations', jsonb_build_object('es', jsonb_build_object(
      'prompt', 'Pregunta ' || ext, 'correct', 'Bien', 'wrong', jsonb_build_array('Mal 1', 'Mal 2', 'Mal 3')))
  ) || extra
$$;

select public.import_questions((select jsonb_agg(pg_temp.question('p-' || i)) from generate_series(1, 6) as i));

-- Importación ----------------------------------------------------------------------------------------
select public.import_questions(jsonb_build_array(pg_temp.question('p-topical', '{"topical": true}')));
select ok(
  (select expires_at between now() + interval '89 days' and now() + interval '91 days'
   from public.questions where external_id = 'p-topical'),
  'una de actualidad sin fecha caduca a los 90 días'
);
select public.import_questions(jsonb_build_array(
  pg_temp.question('p-1') - 'status' || jsonb_build_object('translations', jsonb_build_object('en',
    jsonb_build_object('prompt', 'Question p-1', 'correct', 'Right', 'wrong', jsonb_build_array('W1', 'W2', 'W3'))))
));
select is(
  (select status from public.questions where external_id = 'p-1'), 'approved',
  'reimportar sin "status" conserva el estado'
);
select is(
  (select array_agg(locale order by locale) from public.question_translations t
   join public.questions q on q.id = t.question_id where q.external_id = 'p-1'),
  array['en', 'es'], 'importar un idioma no borra los demás'
);

-- Caducidad ------------------------------------------------------------------------------------------
update public.questions set expires_at = now() - interval '1 day' where external_id = 'p-topical';
select ok(
  not public.is_playable((select q from public.questions as q where external_id = 'p-topical')),
  'una pregunta caducada no es jugable'
);
select ok(public.is_playable((select q from public.questions as q where external_id = 'p-2')), 'una aprobada sí');

-- Exportación con estadísticas: 4 respuestas a p-2 (2 aciertos, 1 incorrecta elegida, 1 tiempo agotado).
insert into public.quick_matches (id, owner_id, locale, difficulty, player_count)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'es', 'easy', 1);
insert into public.quick_match_rounds (match_id, position, question_id, answer_order, served_at, answered_at, chosen)
select '00000000-0000-0000-0000-0000000000f1', v.pos, q.id, '{2,1,3,4}', now(), now(), v.chosen
from public.questions as q, (values (0, 1::smallint), (1, 1::smallint), (2, 0::smallint), (3, null::smallint)) as v (pos, chosen)
where q.external_id = 'p-2';

select is(
  (select e -> 'stats' from jsonb_array_elements(public.export_questions()) as e where e ->> 'externalId' = 'p-2'),
  '{"answered": 4, "correct": 2, "topWrong": 1}'::jsonb, 'export_questions cuenta respuestas por posición original'
);
select is(
  (select e -> 'translations' -> 'es' from jsonb_array_elements(public.export_questions()) as e
   where e ->> 'externalId' = 'p-2'),
  '{"prompt": "Pregunta p-2", "correct": "Bien", "wrong": ["Mal 1", "Mal 2", "Mal 3"]}'::jsonb,
  'export_questions usa el formato de importación'
);

-- Revisión -------------------------------------------------------------------------------------------
select public.import_questions(jsonb_build_array(
  pg_temp.question('p-draft-1') - 'status', pg_temp.question('p-draft-2') - 'status',
  pg_temp.question('p-draft-3') - 'status'
));
select is(
  public.review_questions(jsonb_build_array(
    jsonb_build_object('externalId', 'p-draft-1', 'verdict', 'approve'),
    jsonb_build_object('externalId', 'p-draft-2', 'verdict', 'reject', 'note', 'Respuesta ambigua'),
    jsonb_build_object('externalId', 'p-draft-3', 'verdict', 'human', 'note', 'Fuentes contradictorias')
  )),
  3, 'review_questions aplica el lote'
);
select is(
  (select array_agg(status || ':' || needs_human order by external_id) from public.questions
   where external_id like 'p-draft-%'),
  array['approved:false', 'rejected:false', 'draft:true'], 'aprobar, rechazar o pasar a revisión humana'
);
select ok(
  (select bool_and(reviewed_at is not null) from public.questions where external_id like 'p-draft-%'),
  'queda la fecha de revisión'
);
select public.review_questions(jsonb_build_array(
  jsonb_build_object('externalId', 'p-topical', 'verdict', 'approve', 'expiresAt', now() + interval '30 days')
));
select ok(
  public.is_playable((select q from public.questions as q where external_id = 'p-topical')),
  'la revisión puede renovar la caducidad'
);
select throws_like(
  $$ select public.review_questions('[{"externalId": "p-1", "verdict": "maybe"}]') $$,
  '%veredicto no válido%', 'rechaza un veredicto desconocido'
);
select throws_like(
  $$ select public.review_questions('[{"externalId": "nope", "verdict": "approve"}]') $$,
  '%pregunta inexistente%', 'rechaza una pregunta inexistente'
);

-- Servir: solo jugables y con el distintivo de actualidad --------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok('select public.export_questions()', '42501', null, 'el cliente no exporta');
select throws_ok($$ select public.review_questions('[]') $$, '42501', null, 'el cliente no revisa');

select ok(
  public.serve_quick_question(public.start_quick_match('easy')) ? 'topical',
  'la pregunta servida indica si es de actualidad'
);

reset role;
select ok(
  not exists (
    select 1 from public.quick_match_rounds as r
    join public.quick_matches as m on m.id = r.match_id
    join public.questions as q on q.id = r.question_id
    where m.owner_id = '00000000-0000-0000-0000-00000000000a' and m.id <> '00000000-0000-0000-0000-0000000000f1'
      and not public.is_playable(q)
  ),
  'una partida nueva solo usa preguntas jugables'
);

select * from finish();
rollback;

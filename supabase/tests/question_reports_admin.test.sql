-- Reportes de preguntas y panel de revisión. Se ejecuta con `pnpm db:test`; todo se deshace al final.
begin;
select plan(21);

-- Fixtures (como postgres) -------------------------------------------------------------------------
update public.questions set status = 'rejected';
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local');
insert into public.profiles (id, username, avatar_id, locale) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'axolotl-pink', 'es'),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'axolotl-gold', 'en');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000b');

select public.import_questions((
  select jsonb_agg(jsonb_build_object(
    'externalId', 'r-' || i, 'category', 'geography', 'difficulty', 'easy', 'status', 'approved', 'source', 'ai',
    'translations', jsonb_build_object(
      'es', jsonb_build_object('prompt', 'Pregunta ' || i, 'correct', 'Bien', 'wrong', jsonb_build_array('Mal 1', 'Mal 2')),
      'en', jsonb_build_object('prompt', 'Question ' || i, 'correct', 'Right', 'wrong', jsonb_build_array('W1', 'W2')))))
  from generate_series(1, 7) as i
));

-- Reportar desde el modo rápido --------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('test.m', public.start_quick_match('easy')::text, true);
select public.serve_quick_question(current_setting('test.m')::uuid);

select throws_like(
  $$ select public.report_quick_question(current_setting('test.m')::uuid, 0, 'typo') $$,
  'pregunta no encontrada', 'no se reporta una pregunta sin responder'
);
select public.answer_quick_question(current_setting('test.m')::uuid, 0, 0);
select lives_ok(
  $$ select public.report_quick_question(current_setting('test.m')::uuid, 0, 'typo') $$,
  'se reporta una pregunta ya respondida'
);
select lives_ok(
  $$ select public.report_quick_question(current_setting('test.m')::uuid, 0, 'wrong_answer') $$,
  'volver a reportarla cambia el motivo'
);
select throws_like(
  $$ select public.report_quick_question(current_setting('test.m')::uuid, 0, 'boring') $$,
  '%question_reports_reason_check%', 'rechaza un motivo desconocido'
);
select throws_ok('select * from public.question_reports', '42501', null, 'el cliente no lee reportes');
select is(public.is_admin(), false, 'alice no es admin');
select throws_ok('select public.admin_review_queue()', '42501', null, 'un jugador no ve la cola');
select throws_ok(
  $$ select public.admin_review_question(gen_random_uuid(), 'approve') $$, '42501', null, 'ni revisa'
);
select throws_ok(
  $$ select public.admin_update_question(gen_random_uuid(), 'easy', '{}') $$, '42501', null, 'ni corrige'
);

-- Otra cuenta no puede reportar desde la partida de alice.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_like(
  $$ select public.report_quick_question(current_setting('test.m')::uuid, 0, 'typo') $$,
  'pregunta no encontrada', 'solo se reportan preguntas de partidas propias'
);

reset role;
select is(
  (select reason || ':' || locale from public.question_reports),
  'wrong_answer:es', 'un reporte por jugador y pregunta, con el idioma de la partida'
);
select set_config('test.reported', (select question_id::text from public.question_reports), true);

-- Reportar desde un duelo (jugada creada a mano: el flujo del duelo ya tiene sus tests).
insert into public.duels (id, challenger_id, opponent_id, difficulty)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-00000000000b', 'easy');
insert into public.duel_rounds (duel_id, round, category_id)
values ('00000000-0000-0000-0000-0000000000d1', 1, 'geography');
insert into public.duel_plays (duel_id, round, slot, player_id, question_id, locale, answer_order, answered_at)
select '00000000-0000-0000-0000-0000000000d1', 1, 1, '00000000-0000-0000-0000-00000000000b', id, 'en', '{1,2,3}', now()
from public.questions where external_id = 'r-7';

set local role authenticated;
select lives_ok(
  $$ select public.report_duel_question('00000000-0000-0000-0000-0000000000d1', 1, 1, 'ambiguous') $$,
  'bob reporta una pregunta del duelo'
);
select throws_like(
  $$ select public.report_duel_question('00000000-0000-0000-0000-0000000000d1', 1, 2, 'ambiguous') $$,
  'pregunta no encontrada', 'pero no una que no ha jugado'
);

-- Panel (bob es admin) -----------------------------------------------------------------------------
select is(public.is_admin(), true, 'bob es admin');
select is(jsonb_array_length(public.admin_review_queue()), 2, 'la cola tiene las dos preguntas reportadas');
select is(
  (select e -> 'reports' from jsonb_array_elements(public.admin_review_queue()) as e
   where e ->> 'id' = current_setting('test.reported')),
  '[{"count": 1, "reason": "wrong_answer", "locale": "es"}]'::jsonb, 'agrupa los reportes por motivo e idioma'
);

select public.admin_update_question(
  current_setting('test.reported')::uuid, 'medium',
  '{"es": {"prompt": "Pregunta corregida", "correct": "Bien", "wrong": ["Mal 1", "Mal 2"]}}'
);
reset role;
select is(
  (select q.difficulty || ':' || q.status || ':' || t.prompt from public.questions as q
   join public.question_translations as t on t.question_id = q.id and t.locale = 'es'
   where q.id = current_setting('test.reported')::uuid),
  'medium:approved:Pregunta corregida', 'corregir cambia textos y dificultad sin tocar el estado'
);
select is(
  (select count(*)::integer from public.question_translations where question_id = current_setting('test.reported')::uuid),
  2, 'y conserva el otro idioma'
);

set local role authenticated;
select public.admin_review_question(current_setting('test.reported')::uuid, 'reject', 'Respuesta discutible');
select is(jsonb_array_length(public.admin_review_queue()), 1, 'revisar la saca de la cola');
reset role;
select is(
  (select status || ':' || review_note from public.questions where id = current_setting('test.reported')::uuid),
  'rejected:Respuesta discutible', 'el veredicto y la nota quedan guardados'
);
select ok(
  (select resolved_at is not null from public.question_reports
   where question_id = current_setting('test.reported')::uuid),
  'y sus reportes quedan resueltos'
);

select * from finish();
rollback;

-- Estadísticas por categoría y % de acierto de cada pregunta. Se ejecuta con `pnpm db:test`; todo se deshace al final.
-- Las respuestas se montan a mano (como postgres) en los tres modos.
begin;
select plan(12);

-- Fixtures -----------------------------------------------------------------------------------------
update public.questions set status = 'rejected';
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local');
insert into public.profiles (id, username, avatar_id, locale, terms_version) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'axolotl-pink', 'es', 1),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'axolotl-gold', 'en', 1);
-- st-1 de Geografía, st-2 de Historia y st-3..7 de relleno para poder empezar una partida rápida real.
select public.import_questions((
  select jsonb_agg(jsonb_build_object(
    'externalId', 'st-' || i, 'category', case when i = 2 then 'history' else 'geography' end,
    'difficulty', 'easy', 'status', 'approved', 'source', 'manual',
    'translations', jsonb_build_object('es', jsonb_build_object(
      'prompt', 'Pregunta ' || i, 'correct', 'Bien', 'wrong', jsonb_build_array('Mal')))))
  from generate_series(1, 7) as i
));
create function pg_temp.q(external text) returns uuid language sql as $$
  select id from public.questions where external_id = external
$$;

-- Rápida de alice con un invitado (posiciones pares = alice). En pantalla '{1,2}': 0 acierta, 1 falla, null = tiempo.
insert into public.quick_matches (id, owner_id, locale, difficulty, player_count)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'es', 'easy', 2);
insert into public.quick_match_rounds (match_id, position, question_id, answer_order, served_at, answered_at, chosen, is_correct)
values
  ('00000000-0000-0000-0000-0000000000f1', 0, pg_temp.q('st-1'), '{1,2}', now(), now(), 0, true),
  ('00000000-0000-0000-0000-0000000000f1', 1, pg_temp.q('st-1'), '{1,2}', now(), now(), 0, true),
  ('00000000-0000-0000-0000-0000000000f1', 2, pg_temp.q('st-1'), '{1,2}', now(), now(), null, false),
  ('00000000-0000-0000-0000-0000000000f1', 3, pg_temp.q('st-1'), '{1,2}', now(), now(), 1, false),
  ('00000000-0000-0000-0000-0000000000f1', 4, pg_temp.q('st-1'), '{1,2}', now(), null, null, null);

-- Duelo: alice acierta st-2 y bob la falla.
insert into public.duels (id, challenger_id, opponent_id, difficulty)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a',
  '00000000-0000-0000-0000-00000000000b', 'easy');
insert into public.duel_rounds (duel_id, round, category_id) values ('00000000-0000-0000-0000-0000000000d1', 1, 'history');
insert into public.duel_plays (duel_id, round, slot, player_id, question_id, locale, answer_order, served_at,
  answered_at, chosen, is_correct)
values
  ('00000000-0000-0000-0000-0000000000d1', 1, 1, '00000000-0000-0000-0000-00000000000a', pg_temp.q('st-2'), 'es',
    '{1,2}', now(), now(), 0, true),
  ('00000000-0000-0000-0000-0000000000d1', 1, 1, '00000000-0000-0000-0000-00000000000b', pg_temp.q('st-2'), 'es',
    '{2,1}', now(), now(), 0, false);

-- Relámpago: alice falla st-2.
insert into public.live_duels (id, challenger_id, opponent_id, difficulty, challenger_locale, opponent_locale, status)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a',
  '00000000-0000-0000-0000-00000000000b', 'easy', 'es', 'es', 'finished');
insert into public.live_duel_questions (duel_id, position, question_id, answer_order)
values ('00000000-0000-0000-0000-0000000000e1', 0, pg_temp.q('st-2'), '{1,2}');
insert into public.live_duel_answers (duel_id, player_id, position, served_at, answered_at, chosen, is_correct)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a', 0, now(), now(), 1, false);

-- Estadísticas por categoría -----------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is(jsonb_array_length(public.category_stats()), 7, 'todas las categorías activas, también las no jugadas');
select is(public.category_stats() -> 0,
  '{"id": "geography", "name": "Geografía", "color": "#2ECC8F", "answered": 2, "correct": 1}'::jsonb,
  'rápida: solo los turnos del anfitrión respondidos; el tiempo agotado cuenta como fallo');
select is((public.category_stats() -> 1) - 'name' - 'color',
  '{"id": "history", "answered": 2, "correct": 1}'::jsonb, 'duelo por turnos y relámpago también cuentan');
select is(public.category_stats() -> 2 -> 'answered', '0'::jsonb, 'categoría sin jugar: 0');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((public.category_stats() -> 1) - 'color',
  '{"id": "history", "name": "History", "answered": 1, "correct": 0}'::jsonb,
  'cada uno ve solo las suyas, con los nombres en su idioma');

select throws_ok($$ select * from public.question_answers $$, '42501', null,
  'el cliente no lee las respuestas de todos');
select throws_ok($$ select public.question_hit_rate(gen_random_uuid()) $$, '42501', null,
  'el cliente no llama a question_hit_rate directamente');

-- % de acierto de cada pregunta --------------------------------------------------------------------
reset role;
select is(public.question_hit_rate(pg_temp.q('st-1')), null, 'con menos de 20 respuestas no hay %');

-- 16 aciertos más de bob en st-1: 20 respuestas, 18 aciertos (incluidos los del invitado).
insert into public.duels (id, challenger_id, opponent_id, difficulty)
values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000b',
  '00000000-0000-0000-0000-00000000000a', 'easy');
insert into public.duel_rounds (duel_id, round, category_id)
select '00000000-0000-0000-0000-0000000000d2', r, 'geography' from generate_series(1, 6) as r;
insert into public.duel_plays (duel_id, round, slot, player_id, question_id, locale, answer_order, served_at,
  answered_at, chosen, is_correct)
select '00000000-0000-0000-0000-0000000000d2', 1 + (i - 1) / 3, 1 + (i - 1) % 3, '00000000-0000-0000-0000-00000000000b',
  pg_temp.q('st-1'), 'en', '{1,2}', now(), now(), 0, true
from generate_series(1, 16) as i;
select is(public.question_hit_rate(pg_temp.q('st-1')), 90, 'con 20 respuestas: 18 de 20 = 90 %');

select is(
  (select s -> 'stats' from jsonb_array_elements(public.export_questions()) as s where s ->> 'externalId' = 'st-2'),
  '{"answered": 3, "correct": 1, "topWrong": 2}'::jsonb,
  'la revisión de contenido cuenta también el relámpago');

-- Las respuestas devuelven el % -------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('test.m', public.start_quick_match('easy')::text, true);
select public.serve_quick_question(current_setting('test.m')::uuid);
select ok(public.answer_quick_question(current_setting('test.m')::uuid, 0, 0) ? 'hitRate',
  'answer_quick_question devuelve hitRate');
-- La pregunta servida es al azar (de Geografía o de Historia): se mira el total.
select is((select sum((s ->> 'answered')::integer) from jsonb_array_elements(public.category_stats()) as s), 5::bigint,
  'la respuesta recién dada ya cuenta');

select * from finish();
rollback;

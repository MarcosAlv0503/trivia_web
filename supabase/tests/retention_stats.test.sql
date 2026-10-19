-- Retención D1/D7. Se ejecuta con `pnpm db:test`; todo se deshace al final.
begin;
select plan(5);

-- Fixtures (como postgres) -------------------------------------------------------------------------
-- Momento a mediodía (hora de Madrid) de hace n días, para no depender de la hora a la que corre el test.
create function pg_temp.madrid_noon(n integer) returns timestamptz language sql as $$
  select (((now() at time zone 'Europe/Madrid')::date - n) + time '12:00') at time zone 'Europe/Madrid'
$$;

-- Hace 20 días se dan de alta alice (juega al día 1 en rápido y al día 7 en duelo) y bob (solo al día 1);
-- hoy, carol. Hace 20 días no hay más altas, ni siquiera en una BD local con datos de desarrollo.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@test.local');
insert into public.profiles (id, username, avatar_id, locale, terms_version, created_at) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'axolotl-pink', 'es', 1, pg_temp.madrid_noon(20)),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'axolotl-gold', 'es', 1, pg_temp.madrid_noon(20)),
  ('00000000-0000-0000-0000-00000000000c', 'carol', 'axolotl-gold', 'es', 1, now());

select public.import_questions(jsonb_build_array(jsonb_build_object(
  'externalId', 'ret-1', 'category', 'geography', 'difficulty', 'easy', 'status', 'approved', 'source', 'ai',
  'translations', jsonb_build_object(
    'es', jsonb_build_object('prompt', 'Pregunta', 'correct', 'Bien', 'wrong', jsonb_build_array('Mal 1', 'Mal 2'))))));

insert into public.quick_matches (id, owner_id, locale, difficulty, player_count) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'es', 'easy', 1),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000b', 'es', 'easy', 1);
insert into public.quick_match_rounds (match_id, position, question_id, answer_order, served_at, answered_at)
select v.match_id, 0, q.id, '{1,2,3}', v.at, v.at
from public.questions as q,
  (values ('00000000-0000-0000-0000-0000000000f1'::uuid, pg_temp.madrid_noon(19)),
          ('00000000-0000-0000-0000-0000000000f2'::uuid, pg_temp.madrid_noon(19))) as v (match_id, at)
where q.external_id = 'ret-1';

insert into public.duels (id, challenger_id, opponent_id, difficulty)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-00000000000b', 'easy');
insert into public.duel_rounds (duel_id, round, category_id)
values ('00000000-0000-0000-0000-0000000000d1', 1, 'geography');
insert into public.duel_plays (duel_id, round, slot, player_id, question_id, locale, answer_order, answered_at)
select '00000000-0000-0000-0000-0000000000d1', 1, 1, '00000000-0000-0000-0000-00000000000a', id, 'es', '{1,2,3}',
  pg_temp.madrid_noon(13)
from public.questions where external_id = 'ret-1';

-- Cálculo ------------------------------------------------------------------------------------------
select results_eq(
  $$ select signups, d1, d1_pct, d7, d7_pct from public.retention_stats()
     where signup_day = (now() at time zone 'Europe/Madrid')::date - 20 $$,
  $$ values (2::bigint, 2::bigint, 100.0, 1::bigint, 50.0) $$,
  'cuenta D1 (rápido) y D7 (duelo) de la cohorte'
);
select is(
  (select d1 from public.retention_stats() where signup_day = (now() at time zone 'Europe/Madrid')::date),
  null, 'D1 queda vacío mientras el día 1 no ha terminado'
);
select is(
  (select count(*) from public.retention_stats(7)
   where signup_day = (now() at time zone 'Europe/Madrid')::date - 20),
  0::bigint, 'solo incluye los días pedidos'
);

-- Permisos -----------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok('select * from public.retention_stats()', '42501', null, 'un jugador no ve las estadísticas');
reset role;
set local role anon;
select throws_ok('select * from public.retention_stats()', '42501', null, 'sin sesión tampoco');

select * from finish();
rollback;

-- XP: se suma una vez al terminar cada partida rápida o duelo. Se ejecuta con `pnpm db:test`; todo se deshace al final.
-- Las partidas se montan a mano (como postgres) y se terminan con un update, que es lo que hacen las RPC.
begin;
select plan(14);

-- Fixtures -----------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local');
insert into public.profiles (id, username, avatar_id, locale, terms_version) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'axolotl-pink', 'es', 1),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'axolotl-gold', 'es', 1);
select public.import_questions(jsonb_build_array(jsonb_build_object(
  'externalId', 'xp-1', 'category', 'geography', 'difficulty', 'easy', 'status', 'approved', 'source', 'manual',
  'translations', jsonb_build_object('es', jsonb_build_object(
    'prompt', '¿?', 'correct', 'Sí', 'wrong', jsonb_build_array('No'))))));

create function pg_temp.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true);
  select null::void;
$$;
create function pg_temp.xp(target text) returns integer language sql as $$
  select xp from public.profiles where id = target::uuid
$$;

-- Duelo con los puntos de cada jugador en las 3 preguntas de la ronda 1 (null = sin responder).
create function pg_temp.duel(target text, a_points integer[], b_points integer[]) returns void language sql as $$
  insert into public.duels (id, challenger_id, opponent_id, difficulty)
  values (target::uuid, '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'easy');
  insert into public.duel_rounds (duel_id, round, category_id) values (target::uuid, 1, 'geography');
  insert into public.duel_plays (duel_id, round, slot, player_id, question_id, locale, answer_order, answered_at, points)
  select target::uuid, 1, s, player::uuid, (select q.id from public.questions q where q.external_id = 'xp-1'), 'es',
    '{1,2}', case when pts[s] is not null then now() end, pts[s]
  from (values ('00000000-0000-0000-0000-00000000000a', a_points), ('00000000-0000-0000-0000-00000000000b', b_points))
    as v (player, pts), generate_series(1, 3) as s;
$$;

-- Partida rápida -----------------------------------------------------------------------------------
-- Alice con un invitado: los asientos alternan, así que las posiciones pares son suyas.
insert into public.quick_matches (id, owner_id, locale, difficulty, player_count)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'es', 'easy', 2);
insert into public.quick_match_rounds (match_id, position, question_id, answer_order, points)
select '00000000-0000-0000-0000-0000000000f1', p, (select id from public.questions where external_id = 'xp-1'),
  '{1,2}', (array[15, 10, 12, 0])[p + 1]
from generate_series(0, 3) as p;

select is(pg_temp.xp('00000000-0000-0000-0000-00000000000a'), 0, 'sin terminar no hay XP');
update public.quick_matches set finished_at = now() where id = '00000000-0000-0000-0000-0000000000f1';
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000a'), 23,
  'al terminar: la mitad de los puntos del anfitrión (15 + 12) + 10; los del invitado no cuentan');
update public.quick_matches set finished_at = now() + interval '1 minute' where id = '00000000-0000-0000-0000-0000000000f1';
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000a'), 23, 'tocar de nuevo la partida no suma otra vez');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select is(public.get_quick_match('00000000-0000-0000-0000-0000000000f1') -> 'xp',
  '{"gained": 23, "total": 23}'::jsonb, 'get_quick_match devuelve lo ganado y el total tras la partida');

-- Duelos -------------------------------------------------------------------------------------------
select pg_temp.duel('00000000-0000-0000-0000-0000000000d1', '{15,10,0}', '{10,10,10}');
update public.duels set status = 'finished', end_reason = 'completed', finished_at = now(),
  winner_id = '00000000-0000-0000-0000-00000000000b'
where id = '00000000-0000-0000-0000-0000000000d1';
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000a'), 23 + 25 + 20, 'duelo perdido: puntos + 20');
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000b'), 30 + 20 + 30, 'duelo ganado: puntos + 20 + 30');
select is(public.get_duel('00000000-0000-0000-0000-0000000000d1') -> 'xpGain',
  '{"gained": 45, "total": 68}'::jsonb, 'get_duel devuelve lo ganado por quien consulta');
select is((public.get_duel('00000000-0000-0000-0000-0000000000d1') -> 'opponent' ->> 'xp')::integer, 80,
  'get_duel incluye la XP del rival (para su nivel)');

select pg_temp.duel('00000000-0000-0000-0000-0000000000d2', '{10,null,null}', '{null,null,null}');
update public.duels set status = 'finished', end_reason = 'surrender', finished_at = now(),
  winner_id = '00000000-0000-0000-0000-00000000000b'
where id = '00000000-0000-0000-0000-0000000000d2';
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000a'), 68 + 10, 'rendirse: solo los puntos, sin los 20');
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000b'), 80 + 30, 'ganar por rendición: + 30');

select pg_temp.duel('00000000-0000-0000-0000-0000000000d3', '{10,null,null}', '{10,null,null}');
update public.duels set status = 'finished', end_reason = 'completed', finished_at = now()
where id = '00000000-0000-0000-0000-0000000000d3';
select is(pg_temp.xp('00000000-0000-0000-0000-00000000000b'), 110 + 10 + 20 + 10, 'empate: puntos + 20 + 10');

select pg_temp.duel('00000000-0000-0000-0000-0000000000d4', '{null,null,null}', '{null,null,null}');
update public.duels set status = 'finished', end_reason = 'declined', finished_at = now()
where id = '00000000-0000-0000-0000-0000000000d4';
select is((select count(*)::integer from public.xp_events where duel_id = '00000000-0000-0000-0000-0000000000d4'), 0,
  'un duelo rechazado sin jugar no apunta nada');

-- Permisos -----------------------------------------------------------------------------------------
set local role authenticated;
select throws_ok($$ select * from public.xp_events $$, '42501', null, 'el cliente no lee el ledger');
select throws_ok(
  $$ update public.profiles set xp = 999999 where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'el cliente no puede cambiar su XP'
);
reset role;

select * from finish();
rollback;

-- Suscripciones push y aviso de plazo a punto de vencer. Se ejecuta con `pnpm db:test`; todo se deshace al final.
begin;
select plan(11);

-- Fixtures (como postgres) -------------------------------------------------------------------------
-- Los duelos que ya hubiera (p. ej. partidas locales) se cierran para que el test no dependa de ellos.
update public.duels set status = 'finished', end_reason = 'completed' where status = 'active';
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local');
insert into public.profiles (id, username, avatar_id, locale) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'axolotl-pink', 'es'),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'axolotl-gold', 'es');

-- Suscripciones ------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$ select public.save_push_subscription('https://push.test/a', 'key', 'auth') $$, 'alice suscribe su dispositivo'
);
select throws_like(
  $$ select public.save_push_subscription('http://push.test/a', 'key', 'auth') $$,
  '%push_subscriptions_endpoint_check%', 'solo endpoints https'
);
select throws_ok('select * from public.push_subscriptions', '42501', null, 'el cliente no lee suscripciones');
select public.save_push_subscription('https://push.test/' || i, 'key', 'auth') from generate_series(1, 12) as i;

-- El mismo navegador, ahora con la sesión de bob.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select public.save_push_subscription('https://push.test/a', 'key2', 'auth2');
select public.delete_push_subscription('https://push.test/12');

reset role;
select is(
  (select user_id from public.push_subscriptions where endpoint = 'https://push.test/a'),
  '00000000-0000-0000-0000-00000000000b'::uuid, 'un dispositivo pasa a la cuenta que lo registra'
);
select is(
  (select count(*)::integer from public.push_subscriptions where user_id = '00000000-0000-0000-0000-00000000000a'),
  10, 'como mucho 10 dispositivos por cuenta'
);
select ok(
  exists (select 1 from public.push_subscriptions where endpoint = 'https://push.test/3')
    and not exists (select 1 from public.push_subscriptions where endpoint = 'https://push.test/2'),
  'se conservan los más recientes'
);
select ok(
  exists (select 1 from public.push_subscriptions where endpoint = 'https://push.test/12'),
  'no se puede borrar la suscripción de otra cuenta'
);

-- Plazo a punto de vencer --------------------------------------------------------------------------
insert into public.duels (id, challenger_id, opponent_id, difficulty, turn_number, turn_deadline) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-00000000000b', 'easy', 2, now() + interval '2 hours'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-00000000000b', 'easy', 1, now() + interval '20 hours');

select is(public.warn_duel_deadlines(), 1, 'avisa solo de los turnos que vencen en menos de 6 h');
select is(
  (select user_id || ':' || kind || ':' || actor_name from public.notifications
   where duel_id = '00000000-0000-0000-0000-0000000000d1'),
  '00000000-0000-0000-0000-00000000000b:duel_deadline:alice', 'a quien le toca, con el nombre del rival'
);
select is(public.warn_duel_deadlines(), 0, 'una sola vez por turno');
update public.duels set turn_number = 3 where id = '00000000-0000-0000-0000-0000000000d1';
select is(public.warn_duel_deadlines(), 1, 'y otra vez en el turno siguiente');

select * from finish();
rollback;

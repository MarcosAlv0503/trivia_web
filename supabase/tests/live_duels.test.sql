-- Duelo relámpago y presencia. Se ejecuta con `pnpm db:test`; todo se deshace al final.
-- Como en friends_duels: las RPC se llaman como postgres con el usuario simulado en request.jwt.claims; los permisos
-- se comprueban con el rol authenticated. Los relojes se mueven a mano (starts_at, served_at, created_at).
begin;
select plan(35);

-- Fixtures -----------------------------------------------------------------------------------------
update public.questions set status = 'rejected';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@test.local');
insert into public.profiles (id, username, avatar_id, locale, terms_version) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'axolotl-pink', 'es', 1),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'axolotl-gold', 'en', 1),
  ('00000000-0000-0000-0000-00000000000c', 'carol', 'axolotl-mint', 'es', 1);
-- alice–bob y bob–carol son amigos; alice y carol no.
insert into public.friendships (requester_id, addressee_id, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000b', 'accepted');

create function pg_temp.as_user(name text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', case name when 'alice' then '00000000-0000-0000-0000-00000000000a'
                     when 'bob' then '00000000-0000-0000-0000-00000000000b'
                     else '00000000-0000-0000-0000-00000000000c' end,
    'role', 'authenticated')::text, true);
  select null::void;
$$;

create function pg_temp.question(ext text, locales text[]) returns jsonb language sql as $$
  select jsonb_build_object(
    'externalId', ext, 'category', 'geography', 'difficulty', 'easy', 'status', 'approved', 'source', 'manual',
    'translations', (select jsonb_object_agg(l, jsonb_build_object(
      'prompt', 'Q ' || ext || ' ' || l, 'correct', 'OK', 'wrong', jsonb_build_array('No 1', 'No 2', 'No 3')))
      from unnest(locales) as l))
$$;

-- 25 fáciles en es y en, y 10 solo en español: bob juega en inglés, así que esas no deben salir.
select public.import_questions(
  (select jsonb_agg(pg_temp.question('l-both-' || i, array['es', 'en'])) from generate_series(1, 25) as i)
  || (select jsonb_agg(pg_temp.question('l-es-' || i, array['es'])) from generate_series(1, 10) as i)
);

create function pg_temp.duel() returns uuid language sql as $$ select current_setting('test.live')::uuid $$;

-- Índice en pantalla de la correcta en una posición.
create function pg_temp.correct(pos integer) returns integer language sql as $$
  select array_position(answer_order, 1::smallint) - 1
  from public.live_duel_questions where duel_id = pg_temp.duel() and position = pos
$$;

-- Presencia ----------------------------------------------------------------------------------------
select pg_temp.as_user('alice');
select public.touch_presence(false);
select is(public.list_friends() -> 'friends' -> 0 ->> 'presence', 'offline', 'sin latido, bob sale desconectado');

select pg_temp.as_user('bob');
select public.touch_presence(true);
select pg_temp.as_user('alice');
select is(public.list_friends() -> 'friends' -> 0 ->> 'presence', 'busy', 'bob está en otra partida');
select throws_like(
  $$ select public.invite_live_duel('00000000-0000-0000-0000-00000000000b', 'easy') $$,
  'está jugando', 'no se puede retar a quien está jugando'
);

select pg_temp.as_user('bob');
select public.touch_presence(false);
select pg_temp.as_user('alice');
select is(public.list_friends() -> 'friends' -> 0 ->> 'presence', 'online', 'bob está en línea');

update public.profiles set show_online = false where id = '00000000-0000-0000-0000-00000000000a';
select is(
  public.list_friends() -> 'friends' -> 0 ->> 'presence', 'offline', 'quien se oculta tampoco ve a los demás'
);
select pg_temp.as_user('bob');
select is(
  public.list_friends() -> 'friends' -> 0 ->> 'presence', 'offline', 'y los demás no le ven a él'
);
update public.profiles set show_online = true where id = '00000000-0000-0000-0000-00000000000a';

update public.presence set last_seen_at = now() - interval '46 seconds'
where user_id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.as_user('alice');
select throws_like(
  $$ select public.invite_live_duel('00000000-0000-0000-0000-00000000000b', 'easy') $$,
  'no está conectado', 'a los 45 s sin latido ya no está en línea'
);
update public.presence set last_seen_at = now() where user_id = '00000000-0000-0000-0000-00000000000b';

-- Invitación ---------------------------------------------------------------------------------------
select throws_like(
  $$ select public.invite_live_duel('00000000-0000-0000-0000-00000000000c', 'easy') $$,
  'no sois amigos', 'solo se reta a amigos'
);
select throws_like(
  $$ select public.invite_live_duel('00000000-0000-0000-0000-00000000000b', 'hard') $$,
  'no hay suficientes preguntas', 'hacen falta 20 preguntas en los idiomas de los dos'
);
select is((select count(*)::integer from public.live_duels), 0, 'el fallo no deja una partida a medias');

select set_config('test.live', public.invite_live_duel('00000000-0000-0000-0000-00000000000b', 'easy')::text, true);
select is(public.get_live_duel(pg_temp.duel()) ->> 'status', 'pending', 'la invitación queda pendiente');
select is(
  (select question_count::integer from public.live_duels where id = pg_temp.duel()), 25,
  'la reserva usa las que hay en los dos idiomas (hasta 60)'
);
select is(
  (select count(*)::integer from public.live_duel_questions as lq
   join public.question_translations as t on t.question_id = lq.question_id and t.locale = 'en'
   where lq.duel_id = pg_temp.duel()),
  25, 'todas tienen traducción en el idioma del rival'
);
select ok(
  exists (select 1 from public.notifications
          where user_id = '00000000-0000-0000-0000-00000000000b' and kind = 'live_invite' and duel_id = pg_temp.duel()),
  'bob recibe el aviso de invitación'
);
select throws_like(
  $$ select public.invite_live_duel('00000000-0000-0000-0000-00000000000b', 'easy') $$,
  'ya tienes un duelo relámpago', 'una sola partida pendiente o activa por persona'
);
select pg_temp.as_user('carol');
select public.touch_presence(false);
select throws_like(
  $$ select public.invite_live_duel('00000000-0000-0000-0000-00000000000b', 'easy') $$,
  'está jugando', 'no se puede retar a quien ya tiene una invitación'
);

-- Partida ------------------------------------------------------------------------------------------
select pg_temp.as_user('bob');
select public.answer_live_invite(pg_temp.duel(), true);
select ok(
  (public.get_live_duel(pg_temp.duel()) ->> 'startsInMs')::integer between 2000 and 3000,
  'al aceptar empieza en 3 s'
);
select throws_like(
  $$ select public.serve_live_question(pg_temp.duel()) $$, 'aún no ha empezado', 'no se sirve antes de la cuenta atrás'
);

update public.live_duels set starts_at = clock_timestamp() - interval '1 second' where id = pg_temp.duel();
select pg_temp.as_user('alice');
select is(public.serve_live_question(pg_temp.duel()) ->> 'position', '0', 'empieza por la primera');
select is(
  public.serve_live_question(pg_temp.duel()) ->> 'position', '0', 'servir otra vez devuelve la misma (recargar)'
);
select is(
  public.answer_live_question(pg_temp.duel(), 0, pg_temp.correct(0)) ->> 'points', '13',
  'acierto en menos de 3 s = 13'
);

select public.serve_live_question(pg_temp.duel());
update public.live_duel_answers set served_at = clock_timestamp() - interval '4 seconds'
where duel_id = pg_temp.duel() and player_id = '00000000-0000-0000-0000-00000000000a' and position = 1;
select is(public.answer_live_question(pg_temp.duel(), 1, pg_temp.correct(1)) ->> 'points', '10', 'acierto lento = 10');

select public.serve_live_question(pg_temp.duel());
update public.live_duel_answers set served_at = clock_timestamp() - interval '8 seconds'
where duel_id = pg_temp.duel() and player_id = '00000000-0000-0000-0000-00000000000a' and position = 2;
select is(
  public.answer_live_question(pg_temp.duel(), 2, pg_temp.correct(2)) ->> 'points', '0',
  'pasados los 6 s (y el margen) no cuenta'
);
select is(
  (select challenger_score from public.live_duels where id = pg_temp.duel()), 23, 'el marcador suma en la partida'
);

select pg_temp.as_user('bob');
select is(
  public.serve_live_question(pg_temp.duel()) ->> 'prompt', 'Q ' || (
    select q.external_id from public.live_duel_questions as lq join public.questions as q on q.id = lq.question_id
    where lq.duel_id = pg_temp.duel() and lq.position = 0
  ) || ' en',
  'el rival recibe la misma primera pregunta, en su idioma'
);

-- Permisos directos ----------------------------------------------------------------------------------
set local role authenticated;
select throws_ok('select * from public.live_duel_questions', '42501', null, 'el cliente no lee las preguntas');
select throws_ok('select * from public.live_duel_answers', '42501', null, 'el cliente no lee las respuestas');
select throws_ok(
  $$ select public.settle_live_duels('00000000-0000-0000-0000-00000000000a') $$, '42501', null,
  'el cliente no llama a las funciones internas'
);
select is((select count(*)::integer from public.live_duels), 1, 'bob lee su partida (marcador en vivo)');
select pg_temp.as_user('carol');
select is((select count(*)::integer from public.live_duels), 0, 'un tercero no la ve');
reset role;

-- Fin del reloj --------------------------------------------------------------------------------------
update public.live_duels set starts_at = clock_timestamp() - interval '70 seconds' where id = pg_temp.duel();
select pg_temp.as_user('alice');
select throws_like(
  $$ select public.serve_live_question(pg_temp.duel()) $$, 'se acabó tu tiempo', 'sin reloj no hay más preguntas'
);
-- La pregunta abierta de bob caducó hace mucho: ya no está jugando y la partida se cierra.
select is(public.get_live_duel(pg_temp.duel()) ->> 'result', 'win', 'al acabar los dos relojes gana quien más suma');

-- Caducar, rechazar y cancelar -----------------------------------------------------------------------
select set_config('test.live', public.invite_live_duel('00000000-0000-0000-0000-00000000000b', 'easy')::text, true);
update public.live_duels set created_at = now() - interval '31 seconds' where id = pg_temp.duel();
select pg_temp.as_user('bob');
select throws_like(
  $$ select public.answer_live_invite(pg_temp.duel(), true) $$,
  'invitación no disponible', 'la invitación caduca a los 30 s'
);

select pg_temp.as_user('alice');
select set_config('test.live', public.invite_live_duel('00000000-0000-0000-0000-00000000000b', 'easy')::text, true);
select pg_temp.as_user('bob');
select public.answer_live_invite(pg_temp.duel(), false);
select is(public.get_live_duel(pg_temp.duel()) ->> 'status', 'declined', 'el invitado puede rechazar');

select pg_temp.as_user('alice');
select set_config('test.live', public.invite_live_duel('00000000-0000-0000-0000-00000000000b', 'easy')::text, true);
select public.cancel_live_duel(pg_temp.duel());
select is(public.get_live_duel(pg_temp.duel()) ->> 'status', 'cancelled', 'quien reta puede cancelar mientras espera');

select * from finish();
rollback;

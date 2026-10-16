-- Amigos, duelos por turnos y avisos. Se ejecuta con `pnpm db:test`; todo se deshace al final.
-- El flujo de juego se ejecuta como postgres con el usuario simulado en request.jwt.claims (las RPC usan
-- auth.uid()); los permisos se comprueban con el rol authenticated.
begin;
select plan(37);

-- Fixtures -----------------------------------------------------------------------------------------
update public.questions set status = 'rejected';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@test.local');
insert into public.profiles (id, username, avatar_id, locale) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'axolotl-pink', 'es'),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'axolotl-gold', 'en'),
  ('00000000-0000-0000-0000-00000000000c', 'carol', 'axolotl-mint', 'es');

create function pg_temp.as_user(name text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', case name when 'alice' then '00000000-0000-0000-0000-00000000000a'
                     when 'bob' then '00000000-0000-0000-0000-00000000000b'
                     else '00000000-0000-0000-0000-00000000000c' end,
    'role', 'authenticated')::text, true);
  select null::void;
$$;

create function pg_temp.question(ext text, category text, locales text[]) returns jsonb language sql as $$
  select jsonb_build_object(
    'externalId', ext, 'category', category, 'difficulty', 'easy', 'status', 'approved', 'source', 'manual',
    'translations', (select jsonb_object_agg(l, jsonb_build_object(
      'prompt', 'Q ' || ext || ' ' || l, 'correct', 'OK', 'wrong', jsonb_build_array('No 1', 'No 2', 'No 3')))
      from unnest(locales) as l))
$$;

-- 21 preguntas en es y en (geografía e historia) y 5 de ciencia solo en español: bob juega en inglés,
-- así que ciencia nunca debe salir en sus duelos.
select public.import_questions(
  (select jsonb_agg(pg_temp.question('d-geo-' || i, 'geography', array['es', 'en'])) from generate_series(1, 12) as i)
  || (select jsonb_agg(pg_temp.question('d-his-' || i, 'history', array['es', 'en'])) from generate_series(1, 9) as i)
  || (select jsonb_agg(pg_temp.question('d-sci-' || i, 'science', array['es'])) from generate_series(1, 5) as i)
);

-- Juega todo lo que le toque al usuario actual (girar y responder siempre la opción 0).
create function pg_temp.play_turn(target uuid) returns void language plpgsql as $$
declare
  q jsonb;
  act text;
begin
  loop
    act := public.get_duel(target) ->> 'nextAction';
    exit when act not in ('spin', 'answer');
    if act = 'spin' then
      perform public.spin_duel_round(target);
    else
      q := public.serve_duel_question(target);
      perform public.answer_duel_question(target, (q ->> 'round')::integer, (q ->> 'slot')::integer, 0);
    end if;
  end loop;
end;
$$;

-- Búsqueda y solicitudes -----------------------------------------------------------------------------
select pg_temp.as_user('alice');
select is(public.search_players('bo'), '[]'::jsonb, 'la búsqueda exige al menos 3 caracteres');
select is(public.search_players('___'), '[]'::jsonb, 'el _ no actúa como comodín');
select is(
  public.search_players('BOB'),
  '[{"id": "00000000-0000-0000-0000-00000000000b", "username": "bob", "avatarId": "axolotl-gold", "relation": null}]'::jsonb,
  'busca por prefijo sin distinguir mayúsculas y solo expone nombre y avatar'
);
select throws_like(
  $$ select public.start_duel('00000000-0000-0000-0000-00000000000b', 'easy') $$,
  'solo puedes retar a tus amigos', 'no se puede retar a quien no es amigo'
);
select is(public.send_friend_request('00000000-0000-0000-0000-00000000000b'), 'requested', 'alice envía solicitud a bob');
select is(public.search_players('bob') -> 0 ->> 'relation', 'outgoing', 'la búsqueda indica la solicitud enviada');

select pg_temp.as_user('bob');
select is(
  public.list_friends() -> 'incoming' -> 0 ->> 'username', 'alice', 'bob ve la solicitud entrante'
);
select is(public.send_friend_request('00000000-0000-0000-0000-00000000000a'), 'friends', 'pedirla de vuelta la acepta');

select pg_temp.as_user('alice');
select is(public.list_friends() -> 'friends' -> 0 ->> 'username', 'bob', 'ya son amigos');

-- Permisos directos ------------------------------------------------------------------------------------
set local role authenticated;
select throws_ok('select * from public.friendships', '42501', null, 'el cliente no lee amistades');
select throws_ok('select * from public.duel_plays', '42501', null, 'el cliente no lee jugadas de duelos');
select throws_ok(
  $$ select public.notify('00000000-0000-0000-0000-00000000000b', 'duel_turn', '00000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'el cliente no puede crear avisos'
);
select is((select count(*)::integer from public.notifications), 1, 'alice ve solo sus avisos (bob aceptó)');
select pg_temp.as_user('bob');
select is(
  (select kind from public.notifications), 'friend_request', 'bob recibió el aviso de solicitud'
);
reset role;

-- Duelo completo -------------------------------------------------------------------------------------
select pg_temp.as_user('alice');
select set_config('test.duel', public.start_duel('00000000-0000-0000-0000-00000000000b', 'easy')::text, true);
select is(public.get_duel(current_setting('test.duel')::uuid) ->> 'nextAction', 'spin', 'el retador empieza girando');
select throws_like(
  $$ select public.serve_duel_question(current_setting('test.duel')::uuid) $$,
  'no tienes preguntas pendientes', 'no hay pregunta antes de girar'
);

select pg_temp.as_user('bob');
select is(public.get_duel(current_setting('test.duel')::uuid) ->> 'nextAction', 'wait', 'el rival espera');
select throws_like(
  $$ select public.spin_duel_round(current_setting('test.duel')::uuid) $$, 'no te toca girar', 'el rival no puede girar'
);
select pg_temp.as_user('carol');
select is(public.get_duel(current_setting('test.duel')::uuid), null, 'un tercero no ve el duelo');

select pg_temp.as_user('alice');
select pg_temp.play_turn(current_setting('test.duel')::uuid);
select is(
  public.get_duel(current_setting('test.duel')::uuid) ->> 'turnNumber', '2', 'al terminar sus 3 preguntas pasa el turno'
);

select pg_temp.as_user('bob');
select ok(
  (select count(*) = 1 from public.notifications
   where user_id = '00000000-0000-0000-0000-00000000000b' and kind = 'duel_turn'),
  'bob recibe el aviso de turno'
);
select pg_temp.play_turn(current_setting('test.duel')::uuid);
select is(
  (select count(*)::integer from public.duel_plays a join public.duel_plays b
     on b.duel_id = a.duel_id and b.round = a.round and b.slot = a.slot and b.question_id = a.question_id
   where a.duel_id = current_setting('test.duel')::uuid and a.round = 1
     and a.player_id = '00000000-0000-0000-0000-00000000000a' and b.player_id = '00000000-0000-0000-0000-00000000000b'),
  3, 'ambos responden las mismas preguntas'
);
select is(
  (select array_agg(distinct locale) from public.duel_plays
   where duel_id = current_setting('test.duel')::uuid and player_id = '00000000-0000-0000-0000-00000000000b'),
  array['en'], 'a cada uno se le sirven en su idioma'
);

-- Turnos 3 a 7.
select pg_temp.as_user('alice'); select pg_temp.play_turn(current_setting('test.duel')::uuid);
select pg_temp.as_user('bob'); select pg_temp.play_turn(current_setting('test.duel')::uuid);
select pg_temp.as_user('alice'); select pg_temp.play_turn(current_setting('test.duel')::uuid);
select pg_temp.as_user('bob'); select pg_temp.play_turn(current_setting('test.duel')::uuid);
select pg_temp.as_user('alice'); select pg_temp.play_turn(current_setting('test.duel')::uuid);

select is(
  (select status from public.duels where id = current_setting('test.duel')::uuid), 'finished',
  'tras 7 turnos el duelo termina'
);
select ok(
  (select count(*) = 36 and count(distinct question_id) = 18 and bool_and(answered_at is not null)
   from public.duel_plays where duel_id = current_setting('test.duel')::uuid),
  '6 rondas × 3 preguntas, todas respondidas por ambos y sin repetir'
);
select ok(
  not exists (
    select 1 from public.duel_rounds where duel_id = current_setting('test.duel')::uuid and category_id = 'science'
  ),
  'no sale una categoría sin preguntas en el idioma del rival'
);
select is(
  (select winner_id from public.duels where id = current_setting('test.duel')::uuid),
  (select case
     when sum(points) filter (where player_id = '00000000-0000-0000-0000-00000000000a')
        > sum(points) filter (where player_id = '00000000-0000-0000-0000-00000000000b')
       then '00000000-0000-0000-0000-00000000000a'::uuid
     when sum(points) filter (where player_id = '00000000-0000-0000-0000-00000000000a')
        < sum(points) filter (where player_id = '00000000-0000-0000-0000-00000000000b')
       then '00000000-0000-0000-0000-00000000000b'::uuid
   end
   from public.duel_plays where duel_id = current_setting('test.duel')::uuid),
  'gana quien suma más puntos (o empate)'
);
select throws_like(
  $$ select public.spin_duel_round(current_setting('test.duel')::uuid) $$, 'duelo terminado', 'un duelo terminado no sigue'
);

-- Plazo de 48 h ---------------------------------------------------------------------------------------
select pg_temp.as_user('bob');
select set_config('test.late', public.start_duel('00000000-0000-0000-0000-00000000000a', 'easy')::text, true);
update public.duels set turn_deadline = now() - interval '1 minute' where id = current_setting('test.late')::uuid;
select pg_temp.as_user('alice');
select is(
  (select e ->> 'result' from jsonb_array_elements(public.list_duels()) as e
   where e ->> 'id' = current_setting('test.late')),
  'win', 'quien no juega su turno a tiempo pierde'
);

-- Duelo de 3 rondas ---------------------------------------------------------------------------------
select set_config('test.short', public.start_duel('00000000-0000-0000-0000-00000000000b', 'easy', 3)::text, true);
select pg_temp.play_turn(current_setting('test.short')::uuid);
select pg_temp.as_user('bob'); select pg_temp.play_turn(current_setting('test.short')::uuid);
select pg_temp.as_user('alice'); select pg_temp.play_turn(current_setting('test.short')::uuid);
select pg_temp.as_user('bob'); select pg_temp.play_turn(current_setting('test.short')::uuid);
select is(
  (select status from public.duels where id = current_setting('test.short')::uuid), 'finished',
  'un duelo de 3 rondas termina tras 4 turnos'
);
select is(
  (select count(*)::integer from public.duel_plays where duel_id = current_setting('test.short')::uuid), 18,
  '3 rondas × 3 preguntas para cada jugador'
);
select throws_ok(
  $$ select public.start_duel('00000000-0000-0000-0000-00000000000a', 'easy', 4) $$,
  '23514', null, 'solo se admiten 3 o 6 rondas'
);

-- Límite de 3 duelos activos por pareja (cuenten como retador o como rival).
select public.start_duel('00000000-0000-0000-0000-00000000000a', 'easy');
select pg_temp.as_user('alice');
select public.start_duel('00000000-0000-0000-0000-00000000000b', 'easy');
select public.start_duel('00000000-0000-0000-0000-00000000000b', 'easy');
select throws_like(
  $$ select public.start_duel('00000000-0000-0000-0000-00000000000b', 'easy') $$,
  'ya tenéis 3 duelos en curso', 'como mucho 3 duelos activos entre dos jugadores'
);
select public.surrender_duel(id) from public.duels where status = 'active';

-- Rechazar, rendirse y eliminar amigo ----------------------------------------------------------------
select set_config('test.declined', public.start_duel('00000000-0000-0000-0000-00000000000b', 'easy')::text, true);
select pg_temp.play_turn(current_setting('test.declined')::uuid);
select throws_like(
  $$ select public.decline_duel(current_setting('test.declined')::uuid) $$,
  'ya no se puede rechazar', 'el retador no puede rechazar'
);
select pg_temp.as_user('bob');
select public.decline_duel(current_setting('test.declined')::uuid);
select is(
  public.get_duel(current_setting('test.declined')::uuid) ->> 'result', 'cancelled', 'el rival rechaza el duelo'
);

select set_config('test.surrender', public.start_duel('00000000-0000-0000-0000-00000000000a', 'easy')::text, true);
select public.surrender_duel(current_setting('test.surrender')::uuid);
select pg_temp.as_user('alice');
select is(
  public.get_duel(current_setting('test.surrender')::uuid) ->> 'result', 'win', 'si el rival se rinde, ganas'
);

select set_config('test.unfriend', public.start_duel('00000000-0000-0000-0000-00000000000b', 'easy')::text, true);
select public.remove_friend('00000000-0000-0000-0000-00000000000b');
select is(
  public.get_duel(current_setting('test.unfriend')::uuid) ->> 'endReason', 'unfriended',
  'eliminar al amigo cancela los duelos en curso'
);

select * from finish();
rollback;

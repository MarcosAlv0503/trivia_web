-- Fase 3: amigos, duelo por turnos y avisos in-app.
-- Como en el modo rápido, el cliente no toca las tablas: todo pasa por funciones security definer.

-- Utilidades internas ------------------------------------------------------------------------------

-- Usuario actual con el onboarding completado (o error).
create function public.current_player_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception 'perfil no creado' using errcode = 'insufficient_privilege';
  end if;
  return uid;
end;
$$;

-- Avisos ------------------------------------------------------------------------------------------
-- Sirven para avisar al momento (Realtime) a quien está en la web; el estado real (a quién le toca,
-- solicitudes pendientes) se consulta siempre con list_duels / list_friends.

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('friend_request', 'friend_accepted', 'duel_turn', 'duel_finished')),
  -- Nombre de quien lo provoca, copiado para mostrar el aviso sin más consultas.
  actor_name text not null,
  duel_id uuid,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at);

alter table public.notifications enable row level security;

create policy "notifications: lectura de los propios"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- El cliente se suscribe a las inserciones; Realtime aplica la RLS de arriba. (Sin la publicación, p. ej. en el
-- CI que solo arranca Postgres, los avisos simplemente no se emiten.)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

create function public.notify(target uuid, notification_kind text, actor uuid, related_duel uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications where user_id = target and created_at < now() - interval '1 day';
  insert into public.notifications (user_id, kind, actor_name, duel_id)
  select target, notification_kind, p.username, related_duel from public.profiles as p where p.id = actor;
end;
$$;

-- Amigos ------------------------------------------------------------------------------------------

create table public.friendships (
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- Una sola relación por pareja, sea quien sea quien la pidió.
create unique index friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;

create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(a, b)
      and greatest(requester_id, addressee_id) = greatest(a, b)
  );
$$;

-- Búsqueda por prefijo del nombre de usuario (mínimo 3 caracteres, máximo 10 resultados).
-- Solo expone nombre, avatar y la relación con quien busca.
create function public.search_players(query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
  pattern text := lower(btrim(coalesce(query, '')));
begin
  if char_length(pattern) < 3 then
    return '[]'::jsonb;
  end if;
  -- Los nombres solo admiten letras, números y _, pero el _ es comodín en LIKE: se escapa.
  pattern := replace(replace(replace(pattern, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  -- shortcut: LIKE por prefijo sobre lower(username) recorre la tabla; añadir un índice text_pattern_ops si crece.
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'username', s.username, 'avatarId', s.avatar_id, 'relation', s.relation
    ) order by lower(s.username))
    from (
      select p.id, p.username, p.avatar_id,
        case
          when f.status = 'accepted' then 'friend'
          when f.requester_id = uid then 'outgoing'
          when f.addressee_id = uid then 'incoming'
        end as relation
      from public.profiles as p
      left join public.friendships as f
        on (f.requester_id = uid and f.addressee_id = p.id) or (f.addressee_id = uid and f.requester_id = p.id)
      where p.id <> uid and lower(p.username) like pattern
      order by lower(p.username)
      limit 10
    ) as s
  ), '[]'::jsonb);
end;
$$;

-- Envía una solicitud. Si el otro ya te la había enviado, se acepta. Devuelve 'requested' o 'friends'.
create function public.send_friend_request(target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
  existing public.friendships;
begin
  if target = uid or not exists (select 1 from public.profiles where id = target) then
    raise exception 'jugador no válido' using errcode = 'check_violation';
  end if;

  select * into existing from public.friendships
  where (requester_id = uid and addressee_id = target) or (requester_id = target and addressee_id = uid)
  for update;

  if not found then
    insert into public.friendships (requester_id, addressee_id) values (uid, target);
    perform public.notify(target, 'friend_request', uid);
    return 'requested';
  end if;
  if existing.status = 'pending' and existing.addressee_id = uid then
    update public.friendships set status = 'accepted', accepted_at = now()
    where requester_id = target and addressee_id = uid;
    perform public.notify(target, 'friend_accepted', uid);
    return 'friends';
  end if;
  return case when existing.status = 'accepted' then 'friends' else 'requested' end;
end;
$$;

create function public.respond_friend_request(requester uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
begin
  if accept then
    update public.friendships set status = 'accepted', accepted_at = now()
    where requester_id = requester and addressee_id = uid and status = 'pending';
    if found then
      perform public.notify(requester, 'friend_accepted', uid);
    end if;
  else
    delete from public.friendships
    where requester_id = requester and addressee_id = uid and status = 'pending';
  end if;
end;
$$;

-- Elimina la amistad o cancela la solicitud en cualquier sentido. Los duelos en curso terminan sin ganador.
create function public.remove_friend(other uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
begin
  delete from public.friendships
  where (requester_id = uid and addressee_id = other) or (requester_id = other and addressee_id = uid);

  update public.duels set status = 'finished', end_reason = 'unfriended', finished_at = now()
  where status = 'active'
    and ((challenger_id = uid and opponent_id = other) or (challenger_id = other and opponent_id = uid));
end;
$$;

create function public.list_friends()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select
      case when f.requester_id = public.current_player_id() then f.addressee_id else f.requester_id end as other_id,
      case
        when f.status = 'accepted' then 'friends'
        when f.requester_id = public.current_player_id() then 'outgoing'
        else 'incoming'
      end as bucket
    from public.friendships as f
    where public.current_player_id() in (f.requester_id, f.addressee_id)
  )
  select jsonb_build_object(
    'friends', coalesce(jsonb_agg(entry order by entry ->> 'username') filter (where bucket = 'friends'), '[]'),
    'incoming', coalesce(jsonb_agg(entry order by entry ->> 'username') filter (where bucket = 'incoming'), '[]'),
    'outgoing', coalesce(jsonb_agg(entry order by entry ->> 'username') filter (where bucket = 'outgoing'), '[]')
  )
  from (
    select m.bucket, jsonb_build_object('id', p.id, 'username', p.username, 'avatarId', p.avatar_id) as entry
    from mine as m
    join public.profiles as p on p.id = m.other_id
  ) as e;
$$;

-- Duelos ------------------------------------------------------------------------------------------
-- Reglas: 6 rondas. En el turno t (1..7) juega el retador si t es impar y el rival si es par: primero responde
-- las preguntas pendientes de la ronda anterior y, si t <= 6, gira la ruleta (ronda t, categoría al azar,
-- puede repetirse) y responde sus 3 preguntas. Ambos responden las mismas preguntas. Puntuación como en el
-- modo rápido (15 s; 100 + hasta 50). Gana quien sume más; a igualdad, empate. Cada turno dura 48 h: quien
-- no juega a tiempo pierde. El rival puede rechazar el duelo antes de jugar su primera pregunta.

create table public.duels (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users (id) on delete cascade,
  opponent_id uuid not null references auth.users (id) on delete cascade,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  status text not null default 'active' check (status in ('active', 'finished')),
  end_reason text check (end_reason in ('completed', 'timeout', 'surrender', 'declined', 'unfriended')),
  -- null en un duelo terminado = empate o sin ganador (rechazado / amistad eliminada).
  winner_id uuid references auth.users (id) on delete set null,
  turn_number smallint not null default 1 check (turn_number between 1 and 7),
  turn_deadline timestamptz not null default now() + interval '48 hours',
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check (challenger_id <> opponent_id),
  check ((status = 'active') = (end_reason is null))
);

create index duels_challenger_idx on public.duels (challenger_id, status);
create index duels_opponent_idx on public.duels (opponent_id, status);

create table public.duel_rounds (
  duel_id uuid not null references public.duels (id) on delete cascade,
  round smallint not null check (round between 1 and 6),
  category_id text not null references public.categories (id),
  created_at timestamptz not null default now(),
  primary key (duel_id, round)
);

create table public.duel_plays (
  duel_id uuid not null,
  round smallint not null,
  slot smallint not null check (slot between 1 and 3),
  player_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  -- Idioma del jugador al girar: la pregunta se le muestra siempre en ese idioma (y el orden encaja con él).
  locale text not null check (locale in ('es', 'en')),
  -- Igual que en el modo rápido: respuesta en pantalla i = answers[answer_order[i]] (base 1; la 1 es la correcta).
  answer_order smallint[] not null,
  served_at timestamptz,
  answered_at timestamptz,
  chosen smallint,
  is_correct boolean,
  points smallint,
  primary key (duel_id, round, slot, player_id),
  foreign key (duel_id, round) references public.duel_rounds (duel_id, round) on delete cascade
);

create index duel_plays_question_idx on public.duel_plays (question_id);

alter table public.duels enable row level security;
alter table public.duel_rounds enable row level security;
alter table public.duel_plays enable row level security;
revoke all on public.duels, public.duel_rounds, public.duel_plays from anon, authenticated;

-- Quien no ha jugado su turno a tiempo pierde. Se aplica de forma perezosa al consultar o jugar.
create function public.expire_duels(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.duels
  set status = 'finished', end_reason = 'timeout', finished_at = now(),
      winner_id = case when turn_number % 2 = 1 then opponent_id else challenger_id end
  where status = 'active' and turn_deadline < now() and uid in (challenger_id, opponent_id);
$$;

-- Duelo activo del usuario, bloqueado para modificarlo (o error).
create function public.lock_active_duel(target uuid, uid uuid)
returns public.duels
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.duels;
begin
  perform public.expire_duels(uid);
  select * into d from public.duels where id = target and uid in (challenger_id, opponent_id) for update;
  if not found then
    raise exception 'duelo no encontrado' using errcode = 'no_data_found';
  end if;
  if d.status <> 'active' then
    raise exception 'duelo terminado' using errcode = 'P0001', hint = 'duel_finished';
  end if;
  return d;
end;
$$;

-- Qué le toca hacer ahora al usuario: 'spin', 'answer', 'wait' o 'done'.
create function public.duel_next_action(d public.duels, uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when d.status <> 'active' then 'done'
    when uid <> case when d.turn_number % 2 = 1 then d.challenger_id else d.opponent_id end then 'wait'
    when exists (
      select 1 from public.duel_plays
      where duel_id = d.id and player_id = uid and answered_at is null
    ) then 'answer'
    when d.turn_number <= 6
      and (select count(*) from public.duel_rounds where duel_id = d.id) < d.turn_number then 'spin'
    else 'wait'
  end;
$$;

-- Preguntas que aún pueden salir en el duelo: aprobadas, de su dificultad, traducidas a los idiomas de ambos
-- jugadores y no usadas antes en este duelo.
create function public.duel_candidates(target public.duels, locale_a text, locale_b text)
returns table (question_id uuid, category_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.category_id
  from public.questions as q
  join public.categories as c on c.id = q.category_id and c.is_active
  where q.status = 'approved' and q.difficulty = target.difficulty
    and exists (select 1 from public.question_translations as t where t.question_id = q.id and t.locale = locale_a)
    and exists (select 1 from public.question_translations as t where t.question_id = q.id and t.locale = locale_b)
    and exists (select 1 from public.category_translations as ct where ct.category_id = c.id and ct.locale = locale_a)
    and exists (select 1 from public.category_translations as ct where ct.category_id = c.id and ct.locale = locale_b)
    and not exists (select 1 from public.duel_plays as dp where dp.duel_id = target.id and dp.question_id = q.id);
$$;

create function public.start_duel(opponent uuid, duel_difficulty text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
  new_duel_id uuid;
begin
  if not public.are_friends(uid, opponent) then
    raise exception 'solo puedes retar a tus amigos' using errcode = 'P0001', hint = 'not_friends';
  end if;
  insert into public.duels (challenger_id, opponent_id, difficulty)
  values (uid, opponent, duel_difficulty)
  returning id into new_duel_id;
  return new_duel_id;
end;
$$;

-- Gira la ruleta: el servidor elige la categoría y las 3 preguntas de la ronda para ambos jugadores.
create function public.spin_duel_round(duel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
  d public.duels := public.lock_active_duel(spin_duel_round.duel_id, uid);
  locale_c text := (select locale from public.profiles where id = d.challenger_id);
  locale_o text := (select locale from public.profiles where id = d.opponent_id);
  chosen_category text;
  new_round smallint;
begin
  if public.duel_next_action(d, uid) <> 'spin' then
    raise exception 'no te toca girar' using errcode = 'P0001', hint = 'not_your_action';
  end if;

  -- Categoría al azar (puede repetirse) entre las que aún tienen al menos 3 preguntas disponibles.
  select category_id into chosen_category
  from public.duel_candidates(d, locale_c, locale_o)
  group by category_id
  having count(*) >= 3
  order by random()
  limit 1;
  if chosen_category is null then
    raise exception 'no hay suficientes preguntas' using errcode = 'P0001', hint = 'not_enough_questions';
  end if;

  new_round := d.turn_number;
  insert into public.duel_rounds (duel_id, round, category_id) values (d.id, new_round, chosen_category);

  insert into public.duel_plays (duel_id, round, slot, player_id, question_id, locale, answer_order)
  select d.id, new_round, picked.slot, pl.player_id, picked.question_id, pl.locale,
    (
      select array_agg(i::smallint order by random())
      from generate_series(1, (
        select cardinality(t.answers) from public.question_translations as t
        where t.question_id = picked.question_id and t.locale = pl.locale
      )) as i
    )
  from (
    select c.question_id, (row_number() over ())::smallint as slot
    from (
      select question_id from public.duel_candidates(d, locale_c, locale_o)
      where category_id = chosen_category
      order by random()
      limit 3
    ) as c
  ) as picked
  cross join (values (d.challenger_id, locale_c), (d.opponent_id, locale_o)) as pl (player_id, locale);

  return jsonb_build_object('round', new_round, 'categoryId', chosen_category);
end;
$$;

-- Sirve la siguiente pregunta pendiente del usuario y arranca su reloj (recargar no da tiempo extra).
create function public.serve_duel_question(duel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
  d public.duels := public.lock_active_duel(serve_duel_question.duel_id, uid);
  p public.duel_plays;
begin
  if public.duel_next_action(d, uid) <> 'answer' then
    raise exception 'no tienes preguntas pendientes' using errcode = 'P0001', hint = 'not_your_action';
  end if;

  select * into p from public.duel_plays as dp
  where dp.duel_id = d.id and dp.player_id = uid and dp.answered_at is null
  order by dp.round, dp.slot
  limit 1
  for update;

  if p.served_at is null then
    update public.duel_plays as dp set served_at = clock_timestamp()
    where dp.duel_id = d.id and dp.round = p.round and dp.slot = p.slot and dp.player_id = uid
    returning * into p;
  end if;

  return (
    select jsonb_build_object(
      'round', p.round,
      'slot', p.slot,
      'timeLimitMs', 15000,
      'elapsedMs', floor(extract(epoch from clock_timestamp() - p.served_at) * 1000)::integer,
      'category', jsonb_build_object('id', c.id, 'name', coalesce(ct.name, c.id), 'color', c.color),
      'prompt', t.prompt,
      'answers', (
        select jsonb_agg(t.answers[o.idx] order by o.ord)
        from unnest(p.answer_order) with ordinality as o (idx, ord)
      )
    )
    from public.question_translations as t
    join public.duel_rounds as r on r.duel_id = p.duel_id and r.round = p.round
    join public.categories as c on c.id = r.category_id
    left join public.category_translations as ct on ct.category_id = c.id and ct.locale = p.locale
    where t.question_id = p.question_id and t.locale = p.locale
  );
end;
$$;

-- Registra la respuesta (choice = índice en pantalla, null = tiempo agotado), la puntúa y, si el turno se
-- completa, se lo pasa al rival o cierra el duelo.
create function public.answer_duel_question(duel_id uuid, question_round integer, question_slot integer, choice integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Mismas reglas que answer_quick_question.
  time_limit_ms constant integer := 15000;
  grace_ms constant integer := 2000;
  uid uuid := public.current_player_id();
  d public.duels := public.lock_active_duel(answer_duel_question.duel_id, uid);
  other uuid := case when uid = d.challenger_id then d.opponent_id else d.challenger_id end;
  p public.duel_plays;
  elapsed_ms integer;
  correct_choice integer;
  hit boolean;
  earned integer;
  turn_ended boolean := false;
  finished boolean := false;
  score_c integer;
  score_o integer;
begin
  select * into p from public.duel_plays as dp
  where dp.duel_id = d.id and dp.player_id = uid and dp.round = question_round and dp.slot = question_slot
  for update;
  if not found or p.served_at is null or p.answered_at is not null then
    raise exception 'pregunta no disponible' using errcode = 'P0001', hint = 'question_unavailable';
  end if;
  if choice is not null and (choice < 0 or choice >= cardinality(p.answer_order)) then
    raise exception 'respuesta no válida' using errcode = 'check_violation';
  end if;

  elapsed_ms := floor(extract(epoch from clock_timestamp() - p.served_at) * 1000)::integer;
  correct_choice := array_position(p.answer_order, 1::smallint) - 1;
  hit := choice is not distinct from correct_choice and elapsed_ms <= time_limit_ms + grace_ms;
  earned := case
    when hit then 100 + round(50.0 * greatest(0, time_limit_ms - elapsed_ms) / time_limit_ms)::integer
    else 0
  end;

  update public.duel_plays as dp
  set answered_at = clock_timestamp(), chosen = choice, is_correct = hit, points = earned
  where dp.duel_id = d.id and dp.player_id = uid and dp.round = p.round and dp.slot = p.slot;

  -- Fin de turno: no quedan preguntas pendientes y no falta girar.
  if not exists (
       select 1 from public.duel_plays as dp
       where dp.duel_id = d.id and dp.player_id = uid and dp.answered_at is null
     )
     and (select count(*) from public.duel_rounds as r where r.duel_id = d.id) >= least(d.turn_number, 6) then
    turn_ended := true;
    if d.turn_number = 7 then
      finished := true;
      select coalesce(sum(dp.points) filter (where dp.player_id = d.challenger_id), 0),
             coalesce(sum(dp.points) filter (where dp.player_id = d.opponent_id), 0)
      into score_c, score_o
      from public.duel_plays as dp where dp.duel_id = d.id;
      update public.duels
      set status = 'finished', end_reason = 'completed', finished_at = now(),
          winner_id = case
            when score_c > score_o then d.challenger_id
            when score_o > score_c then d.opponent_id
          end
      where id = d.id;
      perform public.notify(other, 'duel_finished', uid, d.id);
    else
      update public.duels
      set turn_number = turn_number + 1, turn_deadline = now() + interval '48 hours'
      where id = d.id;
      perform public.notify(other, 'duel_turn', uid, d.id);
    end if;
  end if;

  return jsonb_build_object(
    'correctIndex', correct_choice,
    'isCorrect', hit,
    'points', earned,
    'turnEnded', turn_ended,
    'finished', finished
  );
end;
$$;

create function public.surrender_duel(duel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
  d public.duels := public.lock_active_duel(surrender_duel.duel_id, uid);
  other uuid := case when uid = d.challenger_id then d.opponent_id else d.challenger_id end;
begin
  update public.duels
  set status = 'finished', end_reason = 'surrender', finished_at = now(), winner_id = other
  where id = d.id;
  perform public.notify(other, 'duel_finished', uid, d.id);
end;
$$;

-- El rival puede rechazar el duelo mientras no haya respondido ninguna pregunta.
create function public.can_decline_duel(d public.duels, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select d.status = 'active' and uid = d.opponent_id and not exists (
    select 1 from public.duel_plays where duel_id = d.id and player_id = uid and answered_at is not null
  );
$$;

create function public.decline_duel(duel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
  d public.duels := public.lock_active_duel(decline_duel.duel_id, uid);
begin
  if not public.can_decline_duel(d, uid) then
    raise exception 'ya no se puede rechazar' using errcode = 'P0001', hint = 'not_your_action';
  end if;
  update public.duels set status = 'finished', end_reason = 'declined', finished_at = now() where id = d.id;
  perform public.notify(d.challenger_id, 'duel_finished', uid, d.id);
end;
$$;

-- Resultado desde el punto de vista del usuario.
create function public.duel_result(d public.duels, uid uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d.status = 'active' then null
    when d.end_reason in ('declined', 'unfriended') then 'cancelled'
    when d.winner_id is null then 'draw'
    when d.winner_id = uid then 'win'
    else 'loss'
  end;
$$;

create function public.get_duel(duel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
-- En las subconsultas, duel_id es siempre la columna (el parámetro se usa como get_duel.duel_id).
#variable_conflict use_column
declare
  uid uuid := public.current_player_id();
  my_locale text := (select locale from public.profiles where id = uid);
  d public.duels;
  other uuid;
begin
  perform public.expire_duels(uid);
  select * into d from public.duels where id = get_duel.duel_id and uid in (challenger_id, opponent_id);
  if not found then
    return null;
  end if;
  other := case when uid = d.challenger_id then d.opponent_id else d.challenger_id end;

  return jsonb_build_object(
    'id', d.id,
    'difficulty', d.difficulty,
    'status', d.status,
    'endReason', d.end_reason,
    'result', public.duel_result(d, uid),
    'turnNumber', d.turn_number,
    'deadline', d.turn_deadline,
    'nextAction', public.duel_next_action(d, uid),
    'canDecline', public.can_decline_duel(d, uid),
    'me', (
      select jsonb_build_object('id', p.id, 'username', p.username, 'avatarId', p.avatar_id, 'score',
        (select coalesce(sum(points), 0) from public.duel_plays where duel_id = d.id and player_id = uid))
      from public.profiles as p where p.id = uid
    ),
    'opponent', (
      select jsonb_build_object('id', p.id, 'username', p.username, 'avatarId', p.avatar_id, 'score',
        (select coalesce(sum(points), 0) from public.duel_plays where duel_id = d.id and player_id = other))
      from public.profiles as p where p.id = other
    ),
    'rounds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'round', r.round,
        'category', jsonb_build_object('id', c.id, 'name', coalesce(ct.name, c.id), 'color', c.color),
        'myPoints', (
          select sum(points) from public.duel_plays
          where duel_id = d.id and round = r.round and player_id = uid and answered_at is not null
        ),
        'opponentPoints', (
          select sum(points) from public.duel_plays
          where duel_id = d.id and round = r.round and player_id = other and answered_at is not null
        )
      ) order by r.round)
      from public.duel_rounds as r
      join public.categories as c on c.id = r.category_id
      left join public.category_translations as ct on ct.category_id = c.id and ct.locale = my_locale
      where r.duel_id = d.id
    ), '[]'::jsonb),
    -- Segmentos de la ruleta.
    'categories', (
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', coalesce(ct.name, c.id), 'color', c.color)
        order by c.sort_order)
      from public.categories as c
      left join public.category_translations as ct on ct.category_id = c.id and ct.locale = my_locale
      where c.is_active
    )
  );
end;
$$;

-- Duelos del usuario: los activos (primero los que le tocan) y los 5 últimos terminados.
create function public.list_duels()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
begin
  perform public.expire_duels(uid);
  return coalesce((
    select jsonb_agg(entry order by sort_group, sort_time)
    from (
      select
        jsonb_build_object(
          'id', d.id,
          'status', d.status,
          'nextAction', public.duel_next_action(d, uid),
          'result', public.duel_result(d, uid),
          'endReason', d.end_reason,
          'round', least(d.turn_number, 6),
          'deadline', d.turn_deadline,
          'opponent', jsonb_build_object('username', p.username, 'avatarId', p.avatar_id),
          'myScore', (select coalesce(sum(points), 0) from public.duel_plays where duel_id = d.id and player_id = uid),
          'opponentScore', (select coalesce(sum(points), 0) from public.duel_plays where duel_id = d.id and player_id = p.id)
        ) as entry,
        case
          when d.status = 'finished' then 2
          when public.duel_next_action(d, uid) in ('spin', 'answer') then 0
          else 1
        end as sort_group,
        case when d.status = 'finished' then -extract(epoch from d.finished_at) else extract(epoch from d.turn_deadline) end as sort_time
      from public.duels as d
      join public.profiles as p on p.id = case when uid = d.challenger_id then d.opponent_id else d.challenger_id end
      where uid in (d.challenger_id, d.opponent_id)
        and (d.status = 'active' or d.id in (
          select f.id from public.duels as f
          where f.status = 'finished' and uid in (f.challenger_id, f.opponent_id)
          order by f.finished_at desc
          limit 5
        ))
    ) as listed
  ), '[]'::jsonb);
end;
$$;

-- Permisos de ejecución -----------------------------------------------------------------------------

-- Internas: solo se llaman desde otras funciones.
revoke execute on function public.current_player_id() from public, anon, authenticated;
revoke execute on function public.notify(uuid, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.expire_duels(uuid) from public, anon, authenticated;
revoke execute on function public.lock_active_duel(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.duel_next_action(public.duels, uuid) from public, anon, authenticated;
revoke execute on function public.duel_candidates(public.duels, text, text) from public, anon, authenticated;
revoke execute on function public.can_decline_duel(public.duels, uuid) from public, anon, authenticated;
revoke execute on function public.duel_result(public.duels, uuid) from public, anon, authenticated;

-- Públicas para usuarios con sesión.
revoke execute on function public.search_players(text) from public, anon;
revoke execute on function public.send_friend_request(uuid) from public, anon;
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.list_friends() from public, anon;
revoke execute on function public.start_duel(uuid, text) from public, anon;
revoke execute on function public.spin_duel_round(uuid) from public, anon;
revoke execute on function public.serve_duel_question(uuid) from public, anon;
revoke execute on function public.answer_duel_question(uuid, integer, integer, integer) from public, anon;
revoke execute on function public.surrender_duel(uuid) from public, anon;
revoke execute on function public.decline_duel(uuid) from public, anon;
revoke execute on function public.get_duel(uuid) from public, anon;
revoke execute on function public.list_duels() from public, anon;
grant execute on function public.search_players(text) to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.list_friends() to authenticated;
grant execute on function public.start_duel(uuid, text) to authenticated;
grant execute on function public.spin_duel_round(uuid) to authenticated;
grant execute on function public.serve_duel_question(uuid) to authenticated;
grant execute on function public.answer_duel_question(uuid, integer, integer, integer) to authenticated;
grant execute on function public.surrender_duel(uuid) to authenticated;
grant execute on function public.decline_duel(uuid) to authenticated;
grant execute on function public.get_duel(uuid) to authenticated;
grant execute on function public.list_duels() to authenticated;

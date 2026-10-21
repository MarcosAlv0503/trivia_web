-- Duelo relámpago: 1 contra 1 en vivo entre amigos conectados
-- (diseño: docs/superpowers/specs/2026-10-21-duelo-relampago-design.md).
-- Reglas: 60 s de juego por jugador, 6 s por pregunta, acierto = 10 (13 si se responde en menos de 3 s), fallo o
-- tiempo agotado = 0. Las mismas preguntas en el mismo orden para los dos; cada uno avanza a su ritmo. Cada respuesta
-- dada con el reloj en marcha le devuelve 1 s (el destello y pedir la siguiente no descuentan). Sin XP.
-- Como en los otros modos, el cliente no toca las tablas de juego: todo pasa por funciones security definer.

-- Presencia ---------------------------------------------------------------------------------------
-- El cliente da un latido cada 20 s mientras la pestaña está visible; "en línea" = visto hace menos de 45 s.
-- Solo se expone a los amigos (list_friends) y con reciprocidad: quien se oculta tampoco ve a los demás.

create table public.presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null,
  -- En otra partida (rápida o turno de duelo): no se le puede retar en vivo.
  busy boolean not null default false
);

alter table public.presence enable row level security;
revoke all on public.presence from anon, authenticated;

alter table public.profiles add column show_online boolean not null default true;
grant update (show_online) on public.profiles to authenticated;

-- 'online' | 'busy' | 'offline' de target visto por viewer (no comprueba la amistad: eso lo hace quien la llama).
create function public.presence_of(viewer uuid, target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when pr.user_id is null
      or pr.last_seen_at < now() - interval '45 seconds'
      or not t.show_online
      or not coalesce((select v.show_online from public.profiles as v where v.id = viewer), false)
      then 'offline'
    when pr.busy then 'busy'
    else 'online'
  end
  from public.profiles as t
  left join public.presence as pr on pr.user_id = t.id
  where t.id = target;
$$;

create function public.touch_presence(is_busy boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.presence (user_id, last_seen_at, busy)
  values (public.current_player_id(), now(), coalesce(is_busy, false))
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at, busy = excluded.busy;
$$;

-- Igual que en xp_and_levels, más 'presence' (solo de los amigos; el resto sale siempre 'offline').
create or replace function public.list_friends()
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
    select m.bucket, jsonb_build_object(
      'id', p.id,
      'username', p.username,
      'avatarId', p.avatar_id,
      'xp', p.xp,
      'presence', case
        when m.bucket = 'friends' then public.presence_of(public.current_player_id(), p.id)
        else 'offline'
      end
    ) as entry
    from mine as m
    join public.profiles as p on p.id = m.other_id
  ) as e;
$$;

-- Tablas -------------------------------------------------------------------------------------------

create table public.live_duels (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users (id) on delete cascade,
  opponent_id uuid not null references auth.users (id) on delete cascade,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  -- Idioma de cada uno al retar: cada jugador ve las preguntas en el suyo.
  challenger_locale text not null check (challenger_locale in ('es', 'en')),
  opponent_locale text not null check (opponent_locale in ('es', 'en')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'finished', 'declined', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  -- Al aceptar: ahora + 3 s de cuenta atrás, para que los dos empiecen a la vez.
  starts_at timestamptz,
  finished_at timestamptz,
  -- Copia de la suma de live_duel_answers, para el marcador en vivo (Realtime).
  challenger_score integer not null default 0,
  opponent_score integer not null default 0,
  question_count smallint not null default 0,
  check (challenger_id <> opponent_id)
);

create index live_duels_challenger_idx on public.live_duels (challenger_id, created_at desc);
create index live_duels_opponent_idx on public.live_duels (opponent_id, created_at desc);

-- Aparte de live_duels: Realtime envía la fila entera, y las preguntas no deben llegar al cliente.
create table public.live_duel_questions (
  duel_id uuid not null references public.live_duels (id) on delete cascade,
  position smallint not null check (position >= 0),
  question_id uuid not null references public.questions (id),
  -- Orden mostrado: la respuesta en pantalla i es answers[answer_order[i]] (base 1; answers[1] es la correcta).
  answer_order smallint[] not null,
  primary key (duel_id, position)
);

create index live_duel_questions_question_idx on public.live_duel_questions (question_id);

create table public.live_duel_answers (
  duel_id uuid not null references public.live_duels (id) on delete cascade,
  player_id uuid not null references auth.users (id) on delete cascade,
  position smallint not null,
  served_at timestamptz not null,
  answered_at timestamptz,
  -- Índice en pantalla (base 0) elegido; null = tiempo agotado.
  chosen smallint,
  is_correct boolean,
  points smallint,
  -- Respondida con el reloj del jugador en marcha: le devuelve 1 s.
  credited boolean,
  primary key (duel_id, player_id, position),
  foreign key (duel_id, position) references public.live_duel_questions (duel_id, position) on delete cascade
);

create index live_duel_answers_player_idx on public.live_duel_answers (player_id);

alter table public.live_duels enable row level security;
alter table public.live_duel_questions enable row level security;
alter table public.live_duel_answers enable row level security;
revoke all on public.live_duels, public.live_duel_questions, public.live_duel_answers from anon, authenticated;

-- Solo lectura de la partida propia, para el marcador en vivo; no tiene nada de las preguntas ni las respuestas.
create policy "live_duels: lectura de los participantes"
  on public.live_duels for select
  to authenticated
  using ((select auth.uid()) in (challenger_id, opponent_id));

grant select on public.live_duels to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.live_duels;
  end if;
end;
$$;

create trigger live_duels_rate_limit
  before insert on public.live_duels
  for each row execute function public.rate_limit_trigger('live_invite', '30', '1 hour');

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('friend_request', 'friend_accepted', 'duel_turn', 'duel_finished', 'duel_deadline', 'live_invite'));

-- Utilidades internas ------------------------------------------------------------------------------
-- Los tiempos usan clock_timestamp(): el reloj de la partida corre también dentro de una transacción.

create function public.live_ms(span interval)
returns integer
language sql
immutable
set search_path = ''
as $$
  select floor(extract(epoch from span) * 1000)::integer;
$$;

-- Cuándo se acaba el reloj de un jugador: 60 s desde el inicio, más 1 s por cada respuesta dada a tiempo.
create function public.live_clock_end(d public.live_duels, player uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select d.starts_at + interval '60 seconds' + interval '1 second' * count(*)
  from public.live_duel_answers as a
  where a.duel_id = d.id and a.player_id = player and a.credited;
$$;

-- Ha terminado: respondió toda la reserva o se le acabó el reloj (con 1 s de margen para la última respuesta).
create function public.live_player_done(d public.live_duels, player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.live_duel_answers as a
     where a.duel_id = d.id and a.player_id = player and a.answered_at is not null) >= d.question_count
    or clock_timestamp() > public.live_clock_end(d, player) + interval '1 second';
$$;

-- Perezoso, como expire_duels: caduca las invitaciones de más de 30 s y cierra las partidas acabadas.
create function public.settle_live_duels(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.live_duels
  set status = 'expired'
  where status = 'pending' and created_at < clock_timestamp() - interval '30 seconds'
    and uid in (challenger_id, opponent_id);

  update public.live_duels as d
  set status = 'finished', finished_at = now()
  where d.status = 'active' and uid in (d.challenger_id, d.opponent_id)
    and public.live_player_done(d, d.challenger_id) and public.live_player_done(d, d.opponent_id);
$$;

create function public.live_points(hit boolean, elapsed_ms integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when not hit then 0 when elapsed_ms < 3000 then 13 else 10 end;
$$;

create function public.live_busy(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.live_duels
    where status in ('pending', 'active') and uid in (challenger_id, opponent_id)
  );
$$;

-- Invitación ---------------------------------------------------------------------------------------

-- Reta a un amigo conectado. Elige ya la reserva de preguntas (las mismas para los dos, en sus dos idiomas).
create function public.invite_live_duel(friend uuid, match_difficulty text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  pool_size constant integer := 60;
  min_questions constant integer := 20;
  uid uuid := public.current_player_id();
  me public.profiles;
  rival public.profiles;
  new_id uuid;
  assigned integer;
begin
  if friend = uid or not public.are_friends(uid, friend) then
    raise exception 'no sois amigos' using errcode = 'P0001', hint = 'not_friends';
  end if;
  -- Dos invitaciones cruzadas a la vez no pueden dejar a nadie en dos partidas.
  perform pg_advisory_xact_lock(hashtextextended('live:' || x::text, 0))
  from (select unnest(array[uid, friend]) as x order by 1) as locked;
  perform public.settle_live_duels(uid);
  perform public.settle_live_duels(friend);

  if public.live_busy(uid) then
    raise exception 'ya tienes un duelo relámpago' using errcode = 'P0001', hint = 'live_in_progress';
  end if;
  case public.presence_of(uid, friend)
    when 'offline' then
      raise exception 'no está conectado' using errcode = 'P0001', hint = 'friend_offline';
    when 'busy' then
      raise exception 'está jugando' using errcode = 'P0001', hint = 'friend_busy';
    else
      if public.live_busy(friend) then
        raise exception 'está jugando' using errcode = 'P0001', hint = 'friend_busy';
      end if;
  end case;

  select * into me from public.profiles where id = uid;
  select * into rival from public.profiles where id = friend;
  insert into public.live_duels (challenger_id, opponent_id, difficulty, challenger_locale, opponent_locale)
  values (uid, friend, match_difficulty, me.locale, rival.locale)
  returning id into new_id;

  -- Primero las que ninguno de los dos ha visto en vivo; después las más antiguas.
  -- shortcut: ordena todas las candidatas; basta para decenas de miles de preguntas, muestrear si crece mucho.
  insert into public.live_duel_questions (duel_id, position, question_id, answer_order)
  select new_id, (row_number() over () - 1)::smallint, picked.id,
    (select array_agg(i::smallint order by random()) from generate_series(1, picked.answer_count) as i)
  from (
    select q.id, least(cardinality(ta.answers), cardinality(tb.answers)) as answer_count
    from public.questions as q
    join public.categories as c on c.id = q.category_id and c.is_active
    join public.question_translations as ta on ta.question_id = q.id and ta.locale = me.locale
    join public.question_translations as tb on tb.question_id = q.id and tb.locale = rival.locale
    left join (
      select lq.question_id, max(a.served_at) as last_seen
      from public.live_duel_answers as a
      join public.live_duel_questions as lq on lq.duel_id = a.duel_id and lq.position = a.position
      where a.player_id in (uid, friend)
      group by lq.question_id
    ) as seen on seen.question_id = q.id
    where public.is_playable(q) and q.difficulty = match_difficulty
      and exists (select 1 from public.category_translations as ct where ct.category_id = c.id and ct.locale = me.locale)
      and exists (select 1 from public.category_translations as ct where ct.category_id = c.id and ct.locale = rival.locale)
    order by seen.last_seen nulls first, random()
    limit pool_size
  ) as picked;

  get diagnostics assigned = row_count;
  if assigned < min_questions then
    raise exception 'no hay suficientes preguntas' using errcode = 'P0001', hint = 'not_enough_questions';
  end if;
  update public.live_duels set question_count = assigned where id = new_id;

  perform public.notify(friend, 'live_invite', uid, new_id);
  return new_id;
end;
$$;

create function public.cancel_live_duel(duel_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.live_duels
  set status = 'cancelled'
  where id = cancel_live_duel.duel_id and challenger_id = public.current_player_id() and status = 'pending';
$$;

-- El invitado acepta (empieza en 3 s) o rechaza.
create function public.answer_live_invite(duel_id uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
  d public.live_duels;
begin
  perform public.settle_live_duels(uid);
  select * into d from public.live_duels
  where id = answer_live_invite.duel_id and opponent_id = uid
  for update;
  if not found or d.status <> 'pending' then
    raise exception 'invitación no disponible' using errcode = 'P0001', hint = 'invite_unavailable';
  end if;
  update public.live_duels
  set status = case when accept then 'active' else 'declined' end,
      starts_at = case when accept then clock_timestamp() + interval '3 seconds' end
  where id = d.id;
end;
$$;

-- Partida ------------------------------------------------------------------------------------------

-- Estado para quien la consulta. Los tiempos van relativos al reloj del servidor (el del móvil puede ir desfasado).
create function public.get_live_duel(duel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
  d public.live_duels;
  other uuid;
  my_score integer;
  their_score integer;
begin
  perform public.settle_live_duels(uid);
  select * into d from public.live_duels
  where id = get_live_duel.duel_id and uid in (challenger_id, opponent_id);
  if not found then
    raise exception 'duelo no encontrado' using errcode = 'no_data_found';
  end if;
  other := case when uid = d.challenger_id then d.opponent_id else d.challenger_id end;
  my_score := case when uid = d.challenger_id then d.challenger_score else d.opponent_score end;
  their_score := case when uid = d.challenger_id then d.opponent_score else d.challenger_score end;

  return jsonb_build_object(
    'id', d.id,
    'status', d.status,
    'difficulty', d.difficulty,
    'isChallenger', uid = d.challenger_id,
    'inviteLeftMs', case when d.status = 'pending'
      then greatest(0, 30000 - public.live_ms(clock_timestamp() - d.created_at)) end,
    'startsInMs', case when d.starts_at is not null then public.live_ms(d.starts_at - clock_timestamp()) end,
    'remainingMs', case when d.status = 'active'
      then greatest(0, public.live_ms(public.live_clock_end(d, uid) - clock_timestamp())) end,
    'done', d.status = 'active' and public.live_player_done(d, uid),
    'result', case
      when d.status <> 'finished' then null
      when my_score > their_score then 'win'
      when my_score < their_score then 'loss'
      else 'draw'
    end,
    'me', public.live_player_summary(d, uid, my_score),
    'opponent', public.live_player_summary(d, other, their_score)
  );
end;
$$;

create function public.live_player_summary(d public.live_duels, player uuid, score integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'avatarId', p.avatar_id,
    'xp', p.xp,
    'score', score,
    'answered', (select count(*) from public.live_duel_answers as a
                 where a.duel_id = d.id and a.player_id = player and a.answered_at is not null),
    'correct', (select count(*) from public.live_duel_answers as a
                where a.duel_id = d.id and a.player_id = player and a.is_correct)
  )
  from public.profiles as p
  where p.id = player;
$$;

-- Sirve la siguiente pregunta del jugador y arranca su reloj. Si ya tenía una abierta (p. ej. al recargar) devuelve
-- la misma con el tiempo ya transcurrido.
create function public.serve_live_question(duel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
  d public.live_duels;
  a public.live_duel_answers;
  answered integer;
  clock_end timestamptz;
  my_locale text;
begin
  select * into d from public.live_duels
  where id = serve_live_question.duel_id and uid in (challenger_id, opponent_id);
  if not found then
    raise exception 'duelo no encontrado' using errcode = 'no_data_found';
  end if;
  if d.status <> 'active' then
    raise exception 'duelo no activo' using errcode = 'P0001', hint = 'live_not_active';
  end if;
  if clock_timestamp() < d.starts_at then
    raise exception 'aún no ha empezado' using errcode = 'P0001', hint = 'live_not_started';
  end if;

  clock_end := public.live_clock_end(d, uid);
  select * into a from public.live_duel_answers as la
  where la.duel_id = d.id and la.player_id = uid and la.answered_at is null;
  if not found then
    select count(*) into answered from public.live_duel_answers as la
    where la.duel_id = d.id and la.player_id = uid;
    if answered >= d.question_count or clock_timestamp() >= clock_end then
      raise exception 'se acabó tu tiempo' using errcode = 'P0001', hint = 'live_time_up';
    end if;
    -- Dos peticiones a la vez: la segunda no inserta y lee la de la primera.
    insert into public.live_duel_answers (duel_id, player_id, position, served_at)
    values (d.id, uid, answered, clock_timestamp())
    on conflict do nothing;
    select * into a from public.live_duel_answers as la
    where la.duel_id = d.id and la.player_id = uid and la.position = answered;
  end if;

  my_locale := case when uid = d.challenger_id then d.challenger_locale else d.opponent_locale end;
  return (
    select jsonb_build_object(
      'position', a.position,
      'timeLimitMs', 6000,
      'elapsedMs', public.live_ms(clock_timestamp() - a.served_at),
      'remainingMs', greatest(0, public.live_ms(clock_end - clock_timestamp())),
      'category', jsonb_build_object('id', c.id, 'name', ct.name, 'color', c.color),
      'topical', q.topical,
      'prompt', t.prompt,
      'answers', (
        select jsonb_agg(t.answers[o.idx] order by o.ord)
        from unnest(lq.answer_order) with ordinality as o (idx, ord)
      )
    )
    from public.live_duel_questions as lq
    join public.questions as q on q.id = lq.question_id
    join public.question_translations as t on t.question_id = q.id and t.locale = my_locale
    join public.categories as c on c.id = q.category_id
    join public.category_translations as ct on ct.category_id = c.id and ct.locale = my_locale
    where lq.duel_id = d.id and lq.position = a.position
  );
end;
$$;

-- Registra la respuesta (choice = índice en pantalla, null = tiempo agotado), la puntúa y revela la correcta.
create function public.answer_live_question(duel_id uuid, question_position integer, choice integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Margen para la latencia de red: una respuesta que llega algo tarde aún cuenta (sin bonus).
  grace_ms constant integer := 1000;
  uid uuid := public.current_player_id();
  d public.live_duels;
  a public.live_duel_answers;
  shown_order smallint[];
  answered_ts timestamptz := clock_timestamp();
  clock_end timestamptz;
  elapsed_ms integer;
  limit_ms integer;
  correct_choice integer;
  hit boolean;
  earned integer;
  remaining_ms integer;
begin
  -- Bloquea la partida: las respuestas de los dos suman en la misma fila.
  select * into d from public.live_duels
  where id = answer_live_question.duel_id and uid in (challenger_id, opponent_id)
  for update;
  if not found then
    raise exception 'duelo no encontrado' using errcode = 'no_data_found';
  end if;
  if d.status <> 'active' then
    raise exception 'duelo no activo' using errcode = 'P0001', hint = 'live_not_active';
  end if;

  select * into a from public.live_duel_answers as la
  where la.duel_id = d.id and la.player_id = uid and la.position = question_position
  for update;
  if not found or a.answered_at is not null then
    raise exception 'pregunta no disponible' using errcode = 'P0001', hint = 'question_unavailable';
  end if;
  select lq.answer_order into shown_order from public.live_duel_questions as lq
  where lq.duel_id = d.id and lq.position = a.position;
  if choice is not null and (choice < 0 or choice >= cardinality(shown_order)) then
    raise exception 'respuesta no válida' using errcode = 'check_violation';
  end if;

  -- La pregunta dura 6 s o lo que le quedara al reloj del jugador, lo que acabe antes.
  clock_end := public.live_clock_end(d, uid);
  elapsed_ms := public.live_ms(answered_ts - a.served_at);
  limit_ms := least(6000, public.live_ms(clock_end - a.served_at));
  correct_choice := array_position(shown_order, 1::smallint) - 1;
  hit := choice is not distinct from correct_choice and elapsed_ms <= limit_ms + grace_ms;
  earned := public.live_points(hit, elapsed_ms);

  update public.live_duel_answers as la
  set answered_at = answered_ts, chosen = choice, is_correct = hit, points = earned,
      credited = answered_ts < clock_end
  where la.duel_id = d.id and la.player_id = uid and la.position = a.position;

  if earned > 0 then
    update public.live_duels
    set challenger_score = challenger_score + case when uid = challenger_id then earned else 0 end,
        opponent_score = opponent_score + case when uid = opponent_id then earned else 0 end
    where id = d.id;
  end if;

  remaining_ms := greatest(0, public.live_ms(public.live_clock_end(d, uid) - clock_timestamp()));
  return jsonb_build_object(
    'correctIndex', correct_choice,
    'isCorrect', hit,
    'points', earned,
    'remainingMs', remaining_ms,
    'done', remaining_ms = 0 or a.position + 1 >= d.question_count
  );
end;
$$;

-- Retención: las respuestas en vivo también cuentan como actividad ----------------------------------
-- Igual que en retention_stats, con live_duel_answers en `activity`.
create or replace function public.retention_stats(days integer default 30)
returns table (
  signup_day date,
  signups bigint,
  d1 bigint,
  d1_pct numeric,
  d7 bigint,
  d7_pct numeric
)
language sql
stable
set search_path = ''
as $$
  with today as (
    select (now() at time zone 'Europe/Madrid')::date as day
  ),
  cohort as (
    select p.id, (p.created_at at time zone 'Europe/Madrid')::date as day
    from public.profiles as p, today as t
    where (p.created_at at time zone 'Europe/Madrid')::date > t.day - days
  ),
  activity as (
    select m.owner_id as user_id, (r.answered_at at time zone 'Europe/Madrid')::date as day
    from public.quick_match_rounds as r
    join public.quick_matches as m on m.id = r.match_id
    where r.answered_at > now() - make_interval(days => days + 8)
    union
    select dp.player_id, (dp.answered_at at time zone 'Europe/Madrid')::date
    from public.duel_plays as dp
    where dp.answered_at > now() - make_interval(days => days + 8)
    union
    select la.player_id, (la.answered_at at time zone 'Europe/Madrid')::date
    from public.live_duel_answers as la
    where la.answered_at > now() - make_interval(days => days + 8)
  ),
  per_user as (
    select
      c.day,
      exists (select 1 from activity as a where a.user_id = c.id and a.day = c.day + 1) as d1,
      exists (select 1 from activity as a where a.user_id = c.id and a.day = c.day + 7) as d7
    from cohort as c
  ),
  counts as (
    select
      u.day,
      count(*) as signups,
      case when u.day + 1 < t.day then count(*) filter (where u.d1) end as d1,
      case when u.day + 7 < t.day then count(*) filter (where u.d7) end as d7
    from per_user as u, today as t
    group by u.day, t.day
  )
  select
    day,
    signups,
    d1,
    round(100.0 * d1 / signups, 1),
    d7,
    round(100.0 * d7 / signups, 1)
  from counts
  order by day desc;
$$;

-- Permisos -----------------------------------------------------------------------------------------

revoke execute on function public.presence_of(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.live_ms(interval) from public, anon, authenticated;
revoke execute on function public.live_clock_end(public.live_duels, uuid) from public, anon, authenticated;
revoke execute on function public.live_player_done(public.live_duels, uuid) from public, anon, authenticated;
revoke execute on function public.settle_live_duels(uuid) from public, anon, authenticated;
revoke execute on function public.live_points(boolean, integer) from public, anon, authenticated;
revoke execute on function public.live_busy(uuid) from public, anon, authenticated;
revoke execute on function public.live_player_summary(public.live_duels, uuid, integer) from public, anon, authenticated;

revoke execute on function public.touch_presence(boolean) from public, anon;
revoke execute on function public.invite_live_duel(uuid, text) from public, anon;
revoke execute on function public.cancel_live_duel(uuid) from public, anon;
revoke execute on function public.answer_live_invite(uuid, boolean) from public, anon;
revoke execute on function public.get_live_duel(uuid) from public, anon;
revoke execute on function public.serve_live_question(uuid) from public, anon;
revoke execute on function public.answer_live_question(uuid, integer, integer) from public, anon;
grant execute on function public.touch_presence(boolean) to authenticated;
grant execute on function public.invite_live_duel(uuid, text) to authenticated;
grant execute on function public.cancel_live_duel(uuid) to authenticated;
grant execute on function public.answer_live_invite(uuid, boolean) to authenticated;
grant execute on function public.get_live_duel(uuid) to authenticated;
grant execute on function public.serve_live_question(uuid) to authenticated;
grant execute on function public.answer_live_question(uuid, integer, integer) to authenticated;

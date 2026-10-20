-- XP y niveles. La XP se suma una sola vez al terminar cada partida:
--   rápida: puntos del anfitrión (los invitados no tienen cuenta) + 20; una partida a medias no da nada.
--   duelo: puntos de todas las rondas + 20 si acaba con normalidad + 30 al ganar (también por rendición o
--   plazo del rival) o + 10 al empatar.
-- El nivel y el título se derivan del total en packages/game-core (progress.ts); aquí solo se guarda la XP.

-- Total acumulado (copia del ledger para no sumarlo en cada lista). No editable: no está en los grants de profiles.
alter table public.profiles add column xp integer not null default 0 check (xp >= 0);

-- Ledger: una fila por jugador y partida. Si el duelo desaparece (el rival borra su cuenta), la XP se conserva.
create table public.xp_events (
  id bigint generated always as identity primary key,
  player_id uuid not null references auth.users (id) on delete cascade,
  quick_match_id uuid references public.quick_matches (id) on delete set null,
  duel_id uuid references public.duels (id) on delete set null,
  amount integer not null check (amount > 0),
  -- Total del jugador tras sumar esta fila: la pantalla de resultados anima la barra desde total - amount.
  total integer not null,
  created_at timestamptz not null default now(),
  unique (player_id, quick_match_id),
  unique (player_id, duel_id)
);

create index xp_events_player_idx on public.xp_events (player_id);

alter table public.xp_events enable row level security;
revoke all on public.xp_events from anon, authenticated;

create function public.grant_xp(player uuid, amount integer, quick_match uuid, duel uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id bigint;
  new_total integer;
begin
  if amount <= 0 then
    return;
  end if;
  -- El unique evita sumar dos veces la misma partida sin abortar la jugada que la termina.
  insert into public.xp_events (player_id, quick_match_id, duel_id, amount, total)
  values (player, quick_match, duel, amount, 0)
  on conflict do nothing
  returning id into event_id;
  if event_id is null then
    return;
  end if;
  update public.profiles set xp = xp + grant_xp.amount where id = player returning xp into new_total;
  update public.xp_events set total = coalesce(new_total, grant_xp.amount) where id = event_id;
end;
$$;

create function public.quick_match_grant_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.grant_xp(new.owner_id, 20 + coalesce((
    select sum(r.points)::integer from public.quick_match_rounds as r
    where r.match_id = new.id and r.position % new.player_count = 0
  ), 0), new.id, null);
  return null;
end;
$$;

create trigger quick_matches_grant_xp
  after update of finished_at on public.quick_matches
  for each row
  when (old.finished_at is null and new.finished_at is not null)
  execute function public.quick_match_grant_xp();

-- Cubre todos los finales (completado, plazo, rendición, rechazo, amistad eliminada) sin tocar cada RPC.
create function public.duel_grant_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  player uuid;
begin
  foreach player in array array[new.challenger_id, new.opponent_id] loop
    perform public.grant_xp(player,
      coalesce((
        select sum(p.points)::integer from public.duel_plays as p
        where p.duel_id = new.id and p.player_id = player and p.answered_at is not null
      ), 0)
      + case when new.end_reason = 'completed' then 20 else 0 end
      + case
          when new.winner_id = player then 30
          when new.winner_id is null and new.end_reason = 'completed' then 10
          else 0
        end,
      null, new.id);
  end loop;
  return null;
end;
$$;

create trigger duels_grant_xp
  after update of status on public.duels
  for each row
  when (old.status = 'active' and new.status = 'finished')
  execute function public.duel_grant_xp();

revoke execute on function public.grant_xp(uuid, integer, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.quick_match_grant_xp() from public, anon, authenticated;
revoke execute on function public.duel_grant_xp() from public, anon, authenticated;

-- Lo ganado en una partida, para la pantalla de resultados: { gained, total } o null.
create function public.xp_gain(player uuid, quick_match uuid, duel uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('gained', e.amount, 'total', e.total)
  from public.xp_events as e
  where e.player_id = player
    and (e.quick_match_id = quick_match or e.duel_id = duel);
$$;

revoke execute on function public.xp_gain(uuid, uuid, uuid) from public, anon, authenticated;

-- RPC existentes, sin más cambio que la XP ------------------------------------------------------------

-- Igual que en quick_matches, más 'xp' (lo ganado por el anfitrión; null hasta terminar).
create or replace function public.get_quick_match(match_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'difficulty', m.difficulty,
    'total', m.player_count * 7,
    'nextPosition', (
      select min(r.position) from public.quick_match_rounds as r
      where r.match_id = m.id and r.answered_at is null
    ),
    'players', (
      select jsonb_agg(jsonb_build_object(
        'seat', p.seat,
        'name', p.name,
        'avatarId', p.avatar_id,
        'score', coalesce(s.score, 0),
        'correct', coalesce(s.correct, 0)
      ) order by p.seat)
      from public.quick_match_players as p
      left join lateral (
        select sum(r.points)::integer as score, count(*) filter (where r.is_correct)::integer as correct
        from public.quick_match_rounds as r
        where r.match_id = m.id and r.position % m.player_count = p.seat
      ) as s on true
      where p.match_id = m.id
    ),
    'xp', public.xp_gain(m.owner_id, m.id, null)
  )
  from public.quick_matches as m
  where m.id = get_quick_match.match_id and m.owner_id = (select auth.uid());
$$;

-- Igual que en friends_and_duels, más 'xp' de cada jugador.
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
    select m.bucket, jsonb_build_object('id', p.id, 'username', p.username, 'avatarId', p.avatar_id, 'xp', p.xp) as entry
    from mine as m
    join public.profiles as p on p.id = m.other_id
  ) as e;
$$;

-- Igual que en username_moderation_and_rate_limits, más 'xp'.
create or replace function public.search_players(query text)
returns jsonb
language plpgsql
volatile
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
  perform public.check_rate_limit('search_players', 30, interval '1 minute');
  -- Los nombres solo admiten letras, números y _, pero el _ es comodín en LIKE: se escapa.
  pattern := replace(replace(replace(pattern, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  -- shortcut: LIKE por prefijo sobre lower(username) recorre la tabla; añadir un índice text_pattern_ops si crece.
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'username', s.username, 'avatarId', s.avatar_id, 'xp', s.xp, 'relation', s.relation
    ) order by lower(s.username))
    from (
      select p.id, p.username, p.avatar_id, p.xp,
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

-- Igual que en duel_round_count_and_limit, más 'xp' de cada jugador y lo ganado ('xpGain', null si no hay).
create or replace function public.get_duel(duel_id uuid)
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
    'roundCount', d.round_count,
    'status', d.status,
    'endReason', d.end_reason,
    'result', public.duel_result(d, uid),
    'turnNumber', d.turn_number,
    'deadline', d.turn_deadline,
    'nextAction', public.duel_next_action(d, uid),
    'canDecline', public.can_decline_duel(d, uid),
    'xpGain', public.xp_gain(uid, null, d.id),
    'me', (
      select jsonb_build_object('id', p.id, 'username', p.username, 'avatarId', p.avatar_id, 'xp', p.xp, 'score',
        (select coalesce(sum(points), 0) from public.duel_plays where duel_id = d.id and player_id = uid))
      from public.profiles as p where p.id = uid
    ),
    'opponent', (
      select jsonb_build_object('id', p.id, 'username', p.username, 'avatarId', p.avatar_id, 'xp', p.xp, 'score',
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

-- Igual que en duel_round_count_and_limit, más 'xp' del rival.
create or replace function public.list_duels()
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
          'round', least(d.turn_number, d.round_count),
          'roundCount', d.round_count,
          'deadline', d.turn_deadline,
          'opponent', jsonb_build_object('username', p.username, 'avatarId', p.avatar_id, 'xp', p.xp),
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

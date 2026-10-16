-- Duelos de 3 o 6 rondas (lo elige quien reta) y máximo 3 duelos activos por pareja de jugadores.
-- Con N rondas hay N + 1 turnos: en el último, quien no giró la ronda N la responde.

alter table public.duels
  add column round_count smallint not null default 6 check (round_count in (3, 6));

alter table public.duels drop constraint duels_turn_number_check;
alter table public.duels add constraint duels_turn_number_check
  check (turn_number between 1 and round_count + 1);

create or replace function public.duel_next_action(d public.duels, uid uuid)
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
    when d.turn_number <= d.round_count
      and (select count(*) from public.duel_rounds where duel_id = d.id) < d.turn_number then 'spin'
    else 'wait'
  end;
$$;

drop function public.start_duel(uuid, text);

create function public.start_duel(opponent uuid, duel_difficulty text, duel_round_count integer default 6)
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

  -- Bloquea la pareja para que dos retos simultáneos no superen el límite.
  perform pg_advisory_xact_lock(hashtextextended(least(uid, opponent)::text || greatest(uid, opponent)::text, 0));
  perform public.expire_duels(uid);
  if (
    select count(*) from public.duels
    where status = 'active'
      and ((challenger_id = uid and opponent_id = opponent) or (challenger_id = opponent and opponent_id = uid))
  ) >= 3 then
    raise exception 'ya tenéis 3 duelos en curso' using errcode = 'P0001', hint = 'too_many_duels';
  end if;

  insert into public.duels (challenger_id, opponent_id, difficulty, round_count)
  values (uid, opponent, duel_difficulty, duel_round_count)
  returning id into new_duel_id;
  return new_duel_id;
end;
$$;

revoke execute on function public.start_duel(uuid, text, integer) from public, anon;
grant execute on function public.start_duel(uuid, text, integer) to authenticated;

create or replace function public.answer_duel_question(duel_id uuid, question_round integer, question_slot integer, choice integer)
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
     and (select count(*) from public.duel_rounds as r where r.duel_id = d.id) >= least(d.turn_number, d.round_count) then
    turn_ended := true;
    if d.turn_number = d.round_count + 1 then
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

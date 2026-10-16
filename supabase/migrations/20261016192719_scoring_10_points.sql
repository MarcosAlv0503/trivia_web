-- Nueva puntuación (modo rápido y duelo): acierto = 10; +5 si se responde en menos de 3 s o, si no,
-- +2 si se responde en menos de la mitad del tiempo; fallo o tiempo agotado = 0.
-- La fórmula vive solo en answer_points; las partidas ya jugadas conservan sus puntos.

create function public.answer_points(hit boolean, elapsed_ms integer, time_limit_ms integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when not hit then 0
    when elapsed_ms < 3000 then 15
    when elapsed_ms < time_limit_ms / 2 then 12
    else 10
  end;
$$;

revoke execute on function public.answer_points(boolean, integer, integer) from public, anon, authenticated;

create or replace function public.answer_quick_question(match_id uuid, question_position integer, choice integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  time_limit_ms constant integer := 15000;
  -- Margen para la latencia de red: una respuesta que llega algo tarde aún cuenta (sin bonus).
  grace_ms constant integer := 2000;
  m public.quick_matches;
  r public.quick_match_rounds;
  elapsed_ms integer;
  correct_choice integer;
  hit boolean;
  earned integer;
  finished boolean;
begin
  select * into m from public.quick_matches
  where id = answer_quick_question.match_id and owner_id = (select auth.uid());
  if not found then
    raise exception 'partida no encontrada' using errcode = 'no_data_found';
  end if;

  select * into r from public.quick_match_rounds
  where quick_match_rounds.match_id = m.id and position = question_position
  for update;
  if not found or r.served_at is null or r.answered_at is not null then
    raise exception 'pregunta no disponible' using errcode = 'P0001', hint = 'question_unavailable';
  end if;
  if choice is not null and (choice < 0 or choice >= cardinality(r.answer_order)) then
    raise exception 'respuesta no válida' using errcode = 'check_violation';
  end if;

  elapsed_ms := floor(extract(epoch from clock_timestamp() - r.served_at) * 1000)::integer;
  correct_choice := array_position(r.answer_order, 1::smallint) - 1;
  hit := choice is not distinct from correct_choice and elapsed_ms <= time_limit_ms + grace_ms;
  earned := public.answer_points(hit, elapsed_ms, time_limit_ms);

  update public.quick_match_rounds
  set answered_at = clock_timestamp(), chosen = choice, is_correct = hit, points = earned
  where quick_match_rounds.match_id = m.id and position = r.position;

  finished := not exists (
    select 1 from public.quick_match_rounds
    where quick_match_rounds.match_id = m.id and answered_at is null
  );
  if finished then
    update public.quick_matches set finished_at = now() where id = m.id;
  end if;

  return jsonb_build_object(
    'correctIndex', correct_choice,
    'isCorrect', hit,
    'points', earned,
    'finished', finished
  );
end;
$$;

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
  earned := public.answer_points(hit, elapsed_ms, time_limit_ms);

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

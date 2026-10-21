-- Fase 5, tarea 2: estadísticas por categoría de cada jugador y % de acierto global de cada pregunta.
-- Todo sale de las respuestas que ya guardan los tres modos: sin contadores aparte que mantener.

-- Para leer las respuestas de un jugador en los duelos por turnos.
create index duel_plays_player_idx on public.duel_plays (player_id);

-- Todas las respuestas dadas en cualquier modo (tiempo agotado = fallo). `picked` = respuesta original elegida
-- (1 = la correcta; null = tiempo agotado). En la rápida, player_id es el anfitrión y `guest` marca los turnos de
-- sus invitados. Solo para uso interno de las funciones.
create view public.question_answers with (security_invoker = true) as
  select m.owner_id as player_id, r.position % m.player_count <> 0 as guest, r.question_id,
    r.answer_order[r.chosen + 1] as picked, r.is_correct
  from public.quick_match_rounds as r
  join public.quick_matches as m on m.id = r.match_id
  where r.answered_at is not null
  union all
  select p.player_id, false, p.question_id, p.answer_order[p.chosen + 1], p.is_correct
  from public.duel_plays as p
  where p.answered_at is not null
  union all
  select a.player_id, false, q.question_id, q.answer_order[a.chosen + 1], a.is_correct
  from public.live_duel_answers as a
  join public.live_duel_questions as q on q.duel_id = a.duel_id and q.position = a.position
  where a.answered_at is not null;

revoke all on public.question_answers from public, anon, authenticated;

-- % de respuestas acertadas de la pregunta (todos los jugadores, modos e idiomas), o null con menos de 20.
create function public.question_hit_rate(question_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select case when count(*) >= 20 then round(100.0 * count(*) filter (where a.is_correct) / count(*))::integer end
  from public.question_answers as a
  where a.question_id = question_hit_rate.question_id;
$$;

revoke execute on function public.question_hit_rate(uuid) from public, anon, authenticated;

-- Respondidas y acertadas por categoría del jugador actual (todas las categorías activas, en su orden).
-- En la rápida local solo cuentan las respuestas del anfitrión.
create function public.category_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', ct.name,
    'color', c.color,
    'answered', coalesce(s.answered, 0),
    'correct', coalesce(s.correct, 0)
  ) order by c.sort_order, c.id), '[]'::jsonb)
  from public.profiles as p
  join public.categories as c on c.is_active
  join public.category_translations as ct on ct.category_id = c.id and ct.locale = p.locale
  left join (
    select q.category_id, count(*)::integer as answered, (count(*) filter (where a.is_correct))::integer as correct
    from public.question_answers as a
    join public.questions as q on q.id = a.question_id
    where a.player_id = public.current_player_id() and not a.guest
    group by q.category_id
  ) as s on s.category_id = c.id
  where p.id = public.current_player_id();
$$;

revoke execute on function public.category_stats() from public, anon;
grant execute on function public.category_stats() to authenticated;

-- Las respuestas devuelven además `hitRate` (question_hit_rate). Resto igual que en scoring_10_points.
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
    'finished', finished,
    'hitRate', public.question_hit_rate(r.question_id)
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
    'finished', finished,
    'hitRate', public.question_hit_rate(p.question_id)
  );
end;
$$;

-- Revisión de contenido: las estadísticas cuentan también las respuestas del duelo relámpago (antes se omitían).
-- Resto igual que en question_reports_and_admin.
create or replace function public.export_questions()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with per_answer as (
    select question_id, picked, count(*) as n from public.question_answers group by question_id, picked
  ),
  stats as (
    select question_id,
      sum(n)::integer as answered,
      coalesce(sum(n) filter (where picked = 1), 0)::integer as correct,
      coalesce(max(n) filter (where picked > 1), 0)::integer as top_wrong
    from per_answer
    group by question_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'externalId', q.external_id,
    'category', q.category_id,
    'difficulty', q.difficulty,
    'status', q.status,
    'source', q.source,
    'topical', q.topical,
    'expiresAt', q.expires_at,
    'createdAt', q.created_at,
    'reviewedAt', q.reviewed_at,
    'needsHuman', q.needs_human,
    'reviewNote', q.review_note,
    'untranslatable', to_jsonb(q.untranslatable),
    'translations', (
      select jsonb_object_agg(t.locale, jsonb_build_object(
        'prompt', t.prompt, 'correct', t.answers[1], 'wrong', to_jsonb(t.answers[2:])))
      from public.question_translations as t
      where t.question_id = q.id
    ),
    'reports', (
      select coalesce(jsonb_agg(jsonb_build_object('reason', r.reason, 'locale', r.locale)), '[]'::jsonb)
      from public.question_reports as r
      where r.question_id = q.id and r.resolved_at is null
    ),
    'stats', jsonb_build_object(
      'answered', coalesce(s.answered, 0),
      'correct', coalesce(s.correct, 0),
      'topWrong', coalesce(s.top_wrong, 0))
  ) order by q.created_at), '[]'::jsonb)
  from public.questions as q
  left join stats as s on s.question_id = q.id;
$$;

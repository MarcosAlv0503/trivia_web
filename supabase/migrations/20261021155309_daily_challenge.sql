-- Fase 5, tarea 4: reto diario. Las mismas 7 preguntas para todos cada día (00:00 de España), una por categoría y de
-- fácil a difícil. Cada jugador lo juega como una partida rápida en solitario enlazada al día: reutiliza el reloj, la
-- puntuación, la XP y las estadísticas de la rápida. Solo un intento por día.

create table public.daily_challenges (
  day date primary key,
  -- Reto #1 = el primer día que existió (los días sin jugar también cuentan).
  number integer not null unique check (number > 0),
  -- En orden de juego. Sin FK por elemento: las preguntas no se borran (como mucho se rechazan).
  question_ids uuid[] not null check (cardinality(question_ids) = 7),
  created_at timestamptz not null default now()
);

alter table public.daily_challenges enable row level security;
revoke all on public.daily_challenges from anon, authenticated;

-- El reto no tiene una dificultad única: daily_day o difficulty, nunca los dos.
alter table public.quick_matches
  add column daily_day date references public.daily_challenges (day),
  alter column difficulty drop not null,
  add constraint quick_matches_daily_check check (
    case when daily_day is null then difficulty is not null else difficulty is null and player_count = 1 end
  );

-- Un intento por jugador y día; también sirve para buscar los resultados de los amigos.
create unique index quick_matches_daily_idx on public.quick_matches (daily_day, owner_id) where daily_day is not null;

-- Día actual del reto.
create function public.daily_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Madrid')::date;
$$;

revoke execute on function public.daily_today() from public, anon, authenticated;

-- El reto de hoy; lo crea el primero que lo pide. Preguntas jugables y traducidas a todos los idiomas de la app
-- (es, en), de 7 categorías activas al azar; dentro de cada una, la de la dificultad que toca y la que hace más
-- tiempo que no sale en un reto.
create function public.ensure_daily_challenge()
returns public.daily_challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.daily_today();
  difficulties constant text[] := array['easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard'];
  ch public.daily_challenges;
  cats text[];
  picked uuid[] := '{}';
  qid uuid;
begin
  select * into ch from public.daily_challenges where day = today;
  if found then
    return ch;
  end if;
  -- Dos peticiones a la vez: la segunda espera a la primera y lee su reto.
  perform pg_advisory_xact_lock(hashtext('daily_challenge'));
  select * into ch from public.daily_challenges where day = today;
  if found then
    return ch;
  end if;

  select array_agg(c.id) into cats from (
    select c.id from public.categories as c
    where c.is_active
      and (select count(*) from public.category_translations as ct where ct.category_id = c.id) = 2
    order by random()
    limit 7
  ) as c;

  for i in 1 .. coalesce(cardinality(cats), 0) loop
    select q.id into qid
    from public.questions as q
    where q.category_id = cats[i] and public.is_playable(q)
      and (select count(*) from public.question_translations as t where t.question_id = q.id) = 2
    order by q.difficulty = difficulties[i] desc,
      (select max(d.day) from public.daily_challenges as d where q.id = any (d.question_ids)) nulls first,
      random()
    limit 1;
    if found then
      picked := picked || qid;
    end if;
  end loop;

  if cardinality(picked) < 7 then
    raise exception 'no hay suficientes preguntas' using errcode = 'P0001', hint = 'not_enough_questions';
  end if;

  insert into public.daily_challenges (day, number, question_ids)
  values (today, today - coalesce((select min(day) from public.daily_challenges), today) + 1, picked)
  returning * into ch;
  return ch;
end;
$$;

revoke execute on function public.ensure_daily_challenge() from public, anon, authenticated;

-- Empieza (o retoma) el reto de hoy del jugador y devuelve el id de su partida rápida.
create function public.start_daily_match()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
  host public.profiles;
  ch public.daily_challenges := public.ensure_daily_challenge();
  new_match_id uuid;
begin
  select id into new_match_id from public.quick_matches where daily_day = ch.day and owner_id = uid;
  if found then
    return new_match_id;
  end if;

  select * into host from public.profiles where id = uid;
  insert into public.quick_matches (owner_id, locale, difficulty, player_count, daily_day)
  values (uid, host.locale, null, 1, ch.day)
  on conflict (daily_day, owner_id) where daily_day is not null do nothing
  returning id into new_match_id;
  -- Otra petición simultánea la acaba de crear.
  if new_match_id is null then
    select id into new_match_id from public.quick_matches where daily_day = ch.day and owner_id = uid;
    return new_match_id;
  end if;

  insert into public.quick_match_players (match_id, seat, name, avatar_id)
  values (new_match_id, 0, host.username, host.avatar_id);

  insert into public.quick_match_rounds (match_id, position, question_id, answer_order)
  select new_match_id, (q.ord - 1)::smallint, q.id,
    (select array_agg(i::smallint order by random())
     from generate_series(1, (select cardinality(t.answers) from public.question_translations as t
                              where t.question_id = q.id and t.locale = host.locale)) as i)
  from unnest(ch.question_ids) with ordinality as q (id, ord);

  return new_match_id;
end;
$$;

-- Resultado de una partida del reto para mostrarlo en cuadritos: aciertos, puntos y cada pregunta en orden con su
-- categoría (nombre en el idioma de quien mira) y si la acertó (null = aún sin responder).
create function public.daily_result(m public.quick_matches, viewer_locale text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'score', coalesce(sum(r.points), 0),
    'correct', count(*) filter (where r.is_correct),
    'rounds', jsonb_agg(jsonb_build_object(
      'categoryId', c.id, 'name', ct.name, 'color', c.color, 'correct', r.is_correct
    ) order by r.position)
  )
  from public.quick_match_rounds as r
  join public.questions as q on q.id = r.question_id
  join public.categories as c on c.id = q.category_id
  join public.category_translations as ct on ct.category_id = c.id and ct.locale = viewer_locale
  where r.match_id = m.id;
$$;

revoke execute on function public.daily_result(public.quick_matches, text) from public, anon, authenticated;

-- Reto de hoy para la portada y la pantalla del reto: número, la partida del jugador (null si no ha empezado) y, solo
-- si ya lo ha terminado, el resultado de los amigos que también lo han terminado (por puntos).
create function public.get_daily()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
  viewer_locale text := (select locale from public.profiles where id = uid);
  ch public.daily_challenges := public.ensure_daily_challenge();
  m public.quick_matches;
begin
  select * into m from public.quick_matches where daily_day = ch.day and owner_id = uid;
  return jsonb_build_object(
    'number', ch.number,
    'match', case when m.id is not null then public.daily_result(m, viewer_locale) || jsonb_build_object(
      'id', m.id,
      'finished', m.finished_at is not null,
      'xp', public.xp_gain(uid, m.id, null)
    ) end,
    'friends', case when m.finished_at is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(entry order by (entry ->> 'score')::integer desc, entry ->> 'username'), '[]'::jsonb)
      from (
        select public.daily_result(fm, viewer_locale) || jsonb_build_object(
          'id', p.id, 'username', p.username, 'avatarId', p.avatar_id, 'xp', p.xp
        ) as entry
        from public.friendships as f
        join public.quick_matches as fm
          on fm.daily_day = ch.day and fm.finished_at is not null
          and fm.owner_id = case when f.requester_id = uid then f.addressee_id else f.requester_id end
        join public.profiles as p on p.id = fm.owner_id
        where f.status = 'accepted' and uid in (f.requester_id, f.addressee_id)
      ) as e
    ) end
  );
end;
$$;

revoke execute on function public.start_daily_match() from public, anon;
revoke execute on function public.get_daily() from public, anon;
grant execute on function public.start_daily_match() to authenticated;
grant execute on function public.get_daily() to authenticated;

-- Servir: el reto de un día ya pasado no sigue (cuenta como incompleto). Resto igual que en question_pipeline.
create or replace function public.serve_quick_question(match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.quick_matches;
  r public.quick_match_rounds;
begin
  select * into m from public.quick_matches
  where id = serve_quick_question.match_id and owner_id = (select auth.uid());
  if not found then
    raise exception 'partida no encontrada' using errcode = 'no_data_found';
  end if;
  if m.daily_day <> public.daily_today() then
    raise exception 'reto caducado' using errcode = 'P0001', hint = 'daily_expired';
  end if;

  select * into r from public.quick_match_rounds
  where quick_match_rounds.match_id = m.id and answered_at is null
  order by position
  limit 1
  for update;
  if not found then
    raise exception 'partida terminada' using errcode = 'P0001', hint = 'match_finished';
  end if;

  if r.served_at is null then
    update public.quick_match_rounds set served_at = clock_timestamp()
    where quick_match_rounds.match_id = r.match_id and position = r.position
    returning * into r;
  end if;

  return (
    select jsonb_build_object(
      'position', r.position,
      'seat', r.position % m.player_count,
      'timeLimitMs', 15000,
      'elapsedMs', floor(extract(epoch from clock_timestamp() - r.served_at) * 1000)::integer,
      'category', jsonb_build_object('id', c.id, 'name', ct.name, 'color', c.color),
      'topical', q.topical,
      'prompt', t.prompt,
      'answers', (
        select jsonb_agg(t.answers[o.idx] order by o.ord)
        from unnest(r.answer_order) with ordinality as o (idx, ord)
      )
    )
    from public.questions as q
    join public.question_translations as t on t.question_id = q.id and t.locale = m.locale
    join public.categories as c on c.id = q.category_id
    join public.category_translations as ct on ct.category_id = c.id and ct.locale = m.locale
    where q.id = r.question_id
  );
end;
$$;

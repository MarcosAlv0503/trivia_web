-- Modo "Preguntas rápidas" (en solitario o local por turnos en un dispositivo).
-- Reglas: 7 preguntas por jugador, 15 s por pregunta, turnos alternos (la posición p la juega el asiento
-- p % jugadores), dificultad elegida al empezar y categorías mezcladas al azar.
-- Puntuación: acierto = 100 + hasta 50 según el tiempo sobrante; fallo o tiempo agotado = 0.
-- Todo se decide aquí: el cliente nunca conoce la respuesta correcta antes de contestar.

create table public.quick_matches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  locale text not null check (locale in ('es', 'en')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  player_count smallint not null check (player_count between 1 and 6),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index quick_matches_owner_idx on public.quick_matches (owner_id, created_at desc);

create table public.quick_match_players (
  match_id uuid not null references public.quick_matches (id) on delete cascade,
  -- El asiento 0 es el anfitrión; el resto, invitados en el orden elegido.
  seat smallint not null check (seat between 0 and 5),
  -- Copia al empezar: el invitado o el perfil pueden cambiar o borrarse después.
  name text not null,
  avatar_id text not null references public.avatars (id),
  primary key (match_id, seat)
);

create table public.quick_match_rounds (
  match_id uuid not null references public.quick_matches (id) on delete cascade,
  position smallint not null check (position >= 0),
  question_id uuid not null references public.questions (id),
  -- Orden mostrado: la respuesta en pantalla i es answers[answer_order[i]] (base 1; answers[1] es la correcta).
  answer_order smallint[] not null,
  served_at timestamptz,
  answered_at timestamptz,
  -- Índice en pantalla (base 0) elegido; null = tiempo agotado.
  chosen smallint,
  is_correct boolean,
  points smallint,
  primary key (match_id, position)
);

create index quick_match_rounds_question_idx on public.quick_match_rounds (question_id);

alter table public.quick_matches enable row level security;
alter table public.quick_match_players enable row level security;
alter table public.quick_match_rounds enable row level security;

-- Sin acceso directo: todo pasa por las funciones de abajo, que comprueban que la partida es del usuario.
revoke all on public.quick_matches, public.quick_match_players, public.quick_match_rounds
  from anon, authenticated;

-- Crea la partida con el anfitrión y los invitados indicados (en ese orden) y le asigna las preguntas.
create function public.start_quick_match(match_difficulty text, guest_ids uuid[] default '{}')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  host public.profiles;
  new_match_id uuid;
  player_total integer;
  question_total integer;
  assigned integer;
begin
  if uid is null then
    raise exception 'no autenticado' using errcode = 'insufficient_privilege';
  end if;
  select * into host from public.profiles where id = uid;
  if not found then
    raise exception 'perfil no creado' using errcode = 'insufficient_privilege';
  end if;

  guest_ids := coalesce(guest_ids, '{}');
  if cardinality(guest_ids) > 5
     or (select count(distinct g) from unnest(guest_ids) as g) <> cardinality(guest_ids)
     or (select count(*) from public.guests where owner_id = uid and id = any (guest_ids))
        <> cardinality(guest_ids) then
    raise exception 'invitados no válidos' using errcode = 'check_violation';
  end if;

  player_total := 1 + cardinality(guest_ids);
  question_total := player_total * 7;

  insert into public.quick_matches (owner_id, locale, difficulty, player_count)
  values (uid, host.locale, match_difficulty, player_total)
  returning id into new_match_id;

  insert into public.quick_match_players (match_id, seat, name, avatar_id)
  select new_match_id, 0, host.username, host.avatar_id
  union all
  select new_match_id, g.seat, gu.name, gu.avatar_id
  from unnest(guest_ids) with ordinality as g (id, seat)
  join public.guests as gu on gu.id = g.id;

  -- shortcut: order by random() recorre todas las preguntas aprobadas de esa dificultad e idioma;
  -- basta para decenas de miles, cambiar a muestreo (tablesample o ids aleatorios) si crece mucho.
  insert into public.quick_match_rounds (match_id, position, question_id, answer_order)
  select new_match_id, (row_number() over () - 1)::smallint, picked.id,
    (select array_agg(i::smallint order by random()) from generate_series(1, picked.answer_count) as i)
  from (
    select q.id, cardinality(t.answers) as answer_count
    from public.questions as q
    join public.question_translations as t on t.question_id = q.id and t.locale = host.locale
    join public.categories as c on c.id = q.category_id and c.is_active
    join public.category_translations as ct on ct.category_id = c.id and ct.locale = host.locale
    where q.status = 'approved' and q.difficulty = match_difficulty
    order by random()
    limit question_total
  ) as picked;

  get diagnostics assigned = row_count;
  if assigned < question_total then
    raise exception 'no hay suficientes preguntas' using errcode = 'P0001', hint = 'not_enough_questions';
  end if;

  return new_match_id;
end;
$$;

-- Estado de la partida: jugadores con su puntuación y la siguiente posición por jugar (null si ha terminado).
create function public.get_quick_match(match_id uuid)
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
    )
  )
  from public.quick_matches as m
  where m.id = get_quick_match.match_id and m.owner_id = (select auth.uid());
$$;

-- Sirve la siguiente pregunta sin pendiente y arranca su reloj. Si ya estaba servida (p. ej. al recargar)
-- devuelve la misma con el tiempo ya transcurrido: recargar no da tiempo extra.
create function public.serve_quick_question(match_id uuid)
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

-- Registra la respuesta (choice = índice en pantalla, null = tiempo agotado), la puntúa y revela la correcta.
create function public.answer_quick_question(match_id uuid, question_position integer, choice integer)
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
  earned := case
    when hit then 100 + round(50.0 * greatest(0, time_limit_ms - elapsed_ms) / time_limit_ms)::integer
    else 0
  end;

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

revoke execute on function public.start_quick_match(text, uuid[]) from public, anon;
revoke execute on function public.get_quick_match(uuid) from public, anon;
revoke execute on function public.serve_quick_question(uuid) from public, anon;
revoke execute on function public.answer_quick_question(uuid, integer, integer) from public, anon;
grant execute on function public.start_quick_match(text, uuid[]) to authenticated;
grant execute on function public.get_quick_match(uuid) to authenticated;
grant execute on function public.serve_quick_question(uuid) to authenticated;
grant execute on function public.answer_quick_question(uuid, integer, integer) to authenticated;

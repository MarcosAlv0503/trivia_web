-- Contenido automático (Fase 4): preguntas de actualidad con caducidad, revisión periódica y exportación para
-- los procesos de `.claude/skills/questions-*` (vía scripts/questions.mts, solo con la clave secreta).

alter table public.questions
  add column topical boolean not null default false,
  -- Las de actualidad caducan (90 días por defecto al importarlas); una caducada deja de servirse.
  add column expires_at timestamptz,
  add column reviewed_at timestamptz,
  -- La duda persistió tras dos revisiones independientes: queda en borrador para el panel de revisión.
  add column needs_human boolean not null default false,
  add column review_note text check (char_length(review_note) <= 500),
  add constraint questions_topical_expiry check (not topical or expires_at is not null);

-- Única definición de "se puede servir en una partida nueva".
create function public.is_playable(q public.questions)
returns boolean
language sql
stable
set search_path = ''
as $$
  select q.status = 'approved' and (q.expires_at is null or q.expires_at > now());
$$;

revoke execute on function public.is_playable(public.questions) from public, anon, authenticated;

-- Importación: ahora admite "topical" y "expiresAt", conserva el estado si no se indica (reimportar al traducir
-- no devuelve una pregunta aprobada a borrador) y solo sustituye los idiomas incluidos.
-- Formato de cada elemento:
--   { "externalId", "category", "difficulty", "status"?, "source", "topical"?, "expiresAt"?,
--     "translations": { "<locale>": { "prompt", "correct", "wrong": [...] } } }
create or replace function public.import_questions(items jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
  tr record;
  qid uuid;
  answers text[];
  is_topical boolean;
  total integer := 0;
begin
  if jsonb_typeof(items) is distinct from 'array' then
    raise exception 'se esperaba un array de preguntas';
  end if;

  for item in select value from jsonb_array_elements(items) loop
    begin
      if jsonb_typeof(item -> 'translations') is distinct from 'object'
         or item -> 'translations' = '{}'::jsonb then
        raise exception 'faltan las traducciones';
      end if;
      is_topical := coalesce((item ->> 'topical')::boolean, false);

      insert into public.questions (external_id, category_id, difficulty, status, source, topical, expires_at)
      values (
        item ->> 'externalId',
        item ->> 'category',
        item ->> 'difficulty',
        coalesce(item ->> 'status', 'draft'),
        item ->> 'source',
        is_topical,
        coalesce((item ->> 'expiresAt')::timestamptz, case when is_topical then now() + interval '90 days' end)
      )
      on conflict (external_id) do update
        set category_id = excluded.category_id,
            difficulty = excluded.difficulty,
            status = case when item ? 'status' then excluded.status else public.questions.status end,
            source = excluded.source,
            topical = excluded.topical,
            expires_at = excluded.expires_at
      returning id into qid;

      delete from public.question_translations
      where question_id = qid and locale in (select jsonb_object_keys(item -> 'translations'));

      for tr in select key as locale, value from jsonb_each(item -> 'translations') loop
        if jsonb_typeof(tr.value -> 'wrong') is distinct from 'array' then
          raise exception '[%] "wrong" debe ser un array', tr.locale;
        end if;
        answers := array[btrim(tr.value ->> 'correct')]
          || array(select btrim(a) from jsonb_array_elements_text(tr.value -> 'wrong') as a);
        if exists (select 1 from unnest(answers) as a where a is null or a = '' or char_length(a) > 120) then
          raise exception '[%] respuestas vacías o de más de 120 caracteres', tr.locale;
        end if;
        if (select count(distinct lower(a)) from unnest(answers) as a) <> cardinality(answers) then
          raise exception '[%] respuestas repetidas', tr.locale;
        end if;

        insert into public.question_translations (question_id, locale, prompt, answers)
        values (qid, tr.locale, btrim(tr.value ->> 'prompt'), answers);
      end loop;
    exception when others then
      raise exception 'pregunta %: %', coalesce(item ->> 'externalId', '(sin externalId)'), sqlerrm;
    end;
    total := total + 1;
  end loop;

  return total;
end;
$$;

-- Todas las preguntas en el formato de import_questions, más metadatos de revisión y estadísticas de juego:
-- respondidas (incluye tiempo agotado), aciertos y veces que se eligió la incorrecta más votada. Las respuestas se
-- cuentan por su posición original, que la traducción conserva en todos los idiomas. Solo para service_role.
create function public.export_questions()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with picks as (
    select question_id, answer_order[chosen + 1] as picked
    from public.quick_match_rounds where answered_at is not null
    union all
    select question_id, answer_order[chosen + 1]
    from public.duel_plays where answered_at is not null
  ),
  per_answer as (
    select question_id, picked, count(*) as n from picks group by question_id, picked
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
    'translations', (
      select jsonb_object_agg(t.locale, jsonb_build_object(
        'prompt', t.prompt, 'correct', t.answers[1], 'wrong', to_jsonb(t.answers[2:])))
      from public.question_translations as t
      where t.question_id = q.id
    ),
    'stats', jsonb_build_object(
      'answered', coalesce(s.answered, 0),
      'correct', coalesce(s.correct, 0),
      'topWrong', coalesce(s.top_wrong, 0))
  ) order by q.created_at), '[]'::jsonb)
  from public.questions as q
  left join stats as s on s.question_id = q.id;
$$;

revoke execute on function public.export_questions() from public, anon, authenticated;
grant execute on function public.export_questions() to service_role;

-- Aplica los veredictos de la revisión automática. Solo para service_role. Formato de cada elemento:
--   { "externalId", "verdict": "approve" | "reject" | "human", "note"?, "expiresAt"? }
-- Las correcciones se importan antes con import_questions; aquí solo cambia el estado.
create function public.review_questions(items jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
  total integer := 0;
begin
  if jsonb_typeof(items) is distinct from 'array' then
    raise exception 'se esperaba un array de revisiones';
  end if;

  for item in select value from jsonb_array_elements(items) loop
    if coalesce(item ->> 'verdict', '') not in ('approve', 'reject', 'human') then
      raise exception 'revisión %: veredicto no válido', coalesce(item ->> 'externalId', '(sin externalId)');
    end if;

    update public.questions
    set status = case item ->> 'verdict' when 'approve' then 'approved' when 'reject' then 'rejected' else 'draft' end,
        needs_human = item ->> 'verdict' = 'human',
        review_note = left(item ->> 'note', 500),
        reviewed_at = now(),
        expires_at = coalesce((item ->> 'expiresAt')::timestamptz, expires_at)
    where external_id = item ->> 'externalId';
    if not found then
      raise exception 'revisión %: pregunta inexistente', coalesce(item ->> 'externalId', '(sin externalId)');
    end if;
    total := total + 1;
  end loop;

  return total;
end;
$$;

revoke execute on function public.review_questions(jsonb) from public, anon, authenticated;
grant execute on function public.review_questions(jsonb) to service_role;

-- Partidas nuevas: solo preguntas jugables (sin caducar). Resto igual que en quick_match_fresh_questions.
create or replace function public.start_quick_match(match_difficulty text, guest_ids uuid[] default '{}')
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

  -- shortcut: ordena todas las preguntas aprobadas de esa dificultad e idioma y recorre todo el historial
  -- de la cuenta; basta para decenas de miles de preguntas y partidas, muestrear o limitar el historial si crece mucho.
  insert into public.quick_match_rounds (match_id, position, question_id, answer_order)
  select new_match_id, (row_number() over () - 1)::smallint, picked.id,
    (select array_agg(i::smallint order by random()) from generate_series(1, picked.answer_count) as i)
  from (
    select q.id, cardinality(t.answers) as answer_count
    from public.questions as q
    join public.question_translations as t on t.question_id = q.id and t.locale = host.locale
    join public.categories as c on c.id = q.category_id and c.is_active
    join public.category_translations as ct on ct.category_id = c.id and ct.locale = host.locale
    left join (
      select r.question_id, max(r.served_at) as last_seen
      from public.quick_match_rounds as r
      join public.quick_matches as m on m.id = r.match_id
      where m.owner_id = uid and r.served_at is not null
      group by r.question_id
    ) as seen on seen.question_id = q.id
    where public.is_playable(q) and q.difficulty = match_difficulty
    order by seen.last_seen nulls first, random()
    limit question_total
  ) as picked;

  get diagnostics assigned = row_count;
  if assigned < question_total then
    raise exception 'no hay suficientes preguntas' using errcode = 'P0001', hint = 'not_enough_questions';
  end if;

  return new_match_id;
end;
$$;

create or replace function public.duel_candidates(target public.duels, locale_a text, locale_b text)
returns table (question_id uuid, category_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.category_id
  from public.questions as q
  join public.categories as c on c.id = q.category_id and c.is_active
  where public.is_playable(q) and q.difficulty = target.difficulty
    and exists (select 1 from public.question_translations as t where t.question_id = q.id and t.locale = locale_a)
    and exists (select 1 from public.question_translations as t where t.question_id = q.id and t.locale = locale_b)
    and exists (select 1 from public.category_translations as ct where ct.category_id = c.id and ct.locale = locale_a)
    and exists (select 1 from public.category_translations as ct where ct.category_id = c.id and ct.locale = locale_b)
    and not exists (select 1 from public.duel_plays as dp where dp.duel_id = target.id and dp.question_id = q.id);
$$;

-- Servir: igual que antes, más "topical" para que el cliente muestre el distintivo de actualidad.
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

create or replace function public.serve_duel_question(duel_id uuid)
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
      'topical', q.topical,
      'prompt', t.prompt,
      'answers', (
        select jsonb_agg(t.answers[o.idx] order by o.ord)
        from unnest(p.answer_order) with ordinality as o (idx, ord)
      )
    )
    from public.question_translations as t
    join public.questions as q on q.id = t.question_id
    join public.duel_rounds as r on r.duel_id = p.duel_id and r.round = p.round
    join public.categories as c on c.id = r.category_id
    left join public.category_translations as ct on ct.category_id = c.id and ct.locale = p.locale
    where t.question_id = p.question_id and t.locale = p.locale
  );
end;
$$;

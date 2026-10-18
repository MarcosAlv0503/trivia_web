-- Fase 4: los jugadores reportan preguntas y los administradores las revisan en el panel (/admin).
-- Los reportes también llegan a la revisión automática (export_questions → pnpm questions to-review).

-- Reportes ----------------------------------------------------------------------------------------

create table public.question_reports (
  question_id uuid not null references public.questions (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  -- Idioma en que se vio la pregunta: el fallo puede estar solo en una traducción.
  locale text not null check (locale in ('es', 'en')),
  reason text not null check (reason in ('wrong_answer', 'ambiguous', 'typo', 'offensive')),
  created_at timestamptz not null default now(),
  -- Se rellena al aplicar una revisión (automática o del panel) a la pregunta.
  resolved_at timestamptz,
  primary key (question_id, reporter_id)
);

create index question_reports_reporter_idx on public.question_reports (reporter_id, created_at);

alter table public.question_reports enable row level security;
revoke all on public.question_reports from anon, authenticated;

-- Un reporte por jugador y pregunta (volver a reportar lo actualiza y lo reabre), como mucho 30 al día.
create function public.file_question_report(question uuid, reporter uuid, report_locale text, report_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.question_reports
      where reporter_id = reporter and created_at > now() - interval '1 day') >= 30 then
    raise exception 'demasiados reportes' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  insert into public.question_reports (question_id, reporter_id, locale, reason)
  values (question, reporter, report_locale, report_reason)
  on conflict (question_id, reporter_id) do update
    set locale = excluded.locale, reason = excluded.reason, created_at = now(), resolved_at = null;
end;
$$;

-- Solo preguntas ya respondidas de una partida propia (así no se puede reportar para ver la correcta antes).
create function public.report_quick_question(match_id uuid, question_position integer, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_question uuid;
  match_locale text;
begin
  select r.question_id, m.locale into found_question, match_locale
  from public.quick_match_rounds as r
  join public.quick_matches as m on m.id = r.match_id
  where r.match_id = report_quick_question.match_id and r.position = question_position
    and m.owner_id = (select auth.uid()) and r.answered_at is not null;
  if not found then
    raise exception 'pregunta no encontrada' using errcode = 'no_data_found';
  end if;
  perform public.file_question_report(found_question, auth.uid(), match_locale, reason);
end;
$$;

create function public.report_duel_question(duel_id uuid, question_round integer, question_slot integer, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.duel_plays;
begin
  select * into p from public.duel_plays as dp
  where dp.duel_id = report_duel_question.duel_id and dp.round = question_round and dp.slot = question_slot
    and dp.player_id = (select auth.uid()) and dp.answered_at is not null;
  if not found then
    raise exception 'pregunta no encontrada' using errcode = 'no_data_found';
  end if;
  perform public.file_question_report(p.question_id, p.player_id, p.locale, reason);
end;
$$;

-- Revisión automática: igual que en question_pipeline, más el cierre de los reportes abiertos.
create or replace function public.review_questions(items jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
  qid uuid;
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
    where external_id = item ->> 'externalId'
    returning id into qid;
    if not found then
      raise exception 'revisión %: pregunta inexistente', coalesce(item ->> 'externalId', '(sin externalId)');
    end if;
    update public.question_reports set resolved_at = now() where question_id = qid and resolved_at is null;
    total := total + 1;
  end loop;

  return total;
end;
$$;

-- Igual que en question_untranslatable, más los reportes abiertos.
create or replace function public.export_questions()
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

-- Administradores ---------------------------------------------------------------------------------
-- Se dan de alta a mano con SQL (README > "Administradores"); nadie puede hacerse admin desde la web.

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'solo administradores' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- Cola del panel: preguntas pendientes de revisión humana o con reportes abiertos (las rechazadas no se juegan).
create function public.admin_review_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return (
    select coalesce(jsonb_agg(item order by (item ->> 'needsHuman')::boolean desc, item ->> 'createdAt'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id', q.id,
        'category', jsonb_build_object('id', c.id, 'color', c.color),
        'difficulty', q.difficulty,
        'status', q.status,
        'topical', q.topical,
        'expiresAt', q.expires_at,
        'createdAt', q.created_at,
        'needsHuman', q.needs_human,
        'reviewNote', q.review_note,
        'translations', (
          select jsonb_object_agg(t.locale, jsonb_build_object(
            'prompt', t.prompt, 'correct', t.answers[1], 'wrong', to_jsonb(t.answers[2:])))
          from public.question_translations as t
          where t.question_id = q.id
        ),
        'reports', (
          select coalesce(jsonb_agg(jsonb_build_object('reason', r.reason, 'locale', r.locale, 'count', r.n)), '[]'::jsonb)
          from (
            select reason, locale, count(*)::integer as n from public.question_reports
            where question_id = q.id and resolved_at is null
            group by reason, locale
          ) as r
        )
      ) as item
      from public.questions as q
      join public.categories as c on c.id = q.category_id
      where q.status <> 'rejected'
        and (q.needs_human
             or exists (select 1 from public.question_reports as r where r.question_id = q.id and r.resolved_at is null))
      -- shortcut: como mucho 50 por carga; paginar si la cola crece más.
      order by q.needs_human desc, q.created_at
      limit 50
    ) as queue
  );
end;
$$;

-- Aprobar o rechazar desde el panel: mismo camino que la revisión automática (y cierra los reportes).
create function public.admin_review_question(question_id uuid, verdict text, note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  if verdict not in ('approve', 'reject') then
    raise exception 'veredicto no válido' using errcode = 'check_violation';
  end if;
  perform public.review_questions(jsonb_build_array(jsonb_build_object(
    'externalId', (select external_id from public.questions where id = admin_review_question.question_id),
    'verdict', verdict,
    'note', coalesce(nullif(btrim(note), ''), 'panel de revisión')
  )));
end;
$$;

-- Corregir desde el panel: mismo camino y validaciones que la importación. Formato de "translations" como en
-- import_questions; solo se sustituyen los idiomas incluidos. No cambia el estado.
create function public.admin_update_question(question_id uuid, question_difficulty text, translations jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.questions;
begin
  perform public.require_admin();
  select * into q from public.questions where id = admin_update_question.question_id;
  if not found then
    raise exception 'pregunta inexistente' using errcode = 'no_data_found';
  end if;
  perform public.import_questions(jsonb_build_array(jsonb_build_object(
    'externalId', q.external_id,
    'category', q.category_id,
    'difficulty', question_difficulty,
    'source', q.source,
    'topical', q.topical,
    'expiresAt', q.expires_at,
    'translations', translations
  )));
end;
$$;

revoke execute on function public.file_question_report(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.require_admin() from public, anon, authenticated;
revoke execute on function public.report_quick_question(uuid, integer, text) from public, anon;
revoke execute on function public.report_duel_question(uuid, integer, integer, text) from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.admin_review_queue() from public, anon;
revoke execute on function public.admin_review_question(uuid, text, text) from public, anon;
revoke execute on function public.admin_update_question(uuid, text, jsonb) from public, anon;
grant execute on function public.report_quick_question(uuid, integer, text) to authenticated;
grant execute on function public.report_duel_question(uuid, integer, integer, text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_review_queue() to authenticated;
grant execute on function public.admin_review_question(uuid, text, text) to authenticated;
grant execute on function public.admin_update_question(uuid, text, jsonb) to authenticated;

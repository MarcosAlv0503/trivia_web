-- Idiomas a los que una pregunta no se traduce porque solo tiene sentido en el original (juegos de palabras,
-- cultura muy local). El proceso de traducción los marca para no volver a proponerlos.

alter table public.questions
  add column untranslatable text[] not null default '{}' check (untranslatable <@ array['es', 'en']);

-- Solo para service_role.
create function public.mark_untranslatable(external_ids text[], target_locale text)
returns integer
language sql
set search_path = ''
as $$
  with marked as (
    update public.questions
    set untranslatable = array(select distinct unnest(untranslatable || target_locale))
    where external_id = any (external_ids)
    returning 1
  )
  select count(*)::integer from marked;
$$;

revoke execute on function public.mark_untranslatable(text[], text) from public, anon, authenticated;
grant execute on function public.mark_untranslatable(text[], text) to service_role;

-- Igual que en question_pipeline, más "untranslatable".
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
    'stats', jsonb_build_object(
      'answered', coalesce(s.answered, 0),
      'correct', coalesce(s.correct, 0),
      'topWrong', coalesce(s.top_wrong, 0))
  ) order by q.created_at), '[]'::jsonb)
  from public.questions as q
  left join stats as s on s.question_id = q.id;
$$;

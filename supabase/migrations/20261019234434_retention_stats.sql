-- Retención D1/D7 por día de alta, calculada con la actividad de juego que ya guardamos: sin terceros ni cookies.
-- Un jugador está activo un día si respondió alguna pregunta (modo rápido o duelo). Días en hora de Madrid.
-- D1/D7 = de los que se dieron de alta ese día, cuántos jugaron 1 y 7 días después; null si ese día aún no ha
-- terminado. Solo para el equipo: Studio → SQL Editor → `select * from public.retention_stats();`.

create function public.retention_stats(days integer default 30)
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

revoke execute on function public.retention_stats(integer) from public, anon, authenticated;
grant execute on function public.retention_stats(integer) to service_role;

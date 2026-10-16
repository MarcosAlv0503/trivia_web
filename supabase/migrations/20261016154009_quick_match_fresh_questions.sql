-- Evita repetir preguntas: start_quick_match elige primero las que la cuenta nunca ha visto y después las
-- vistas hace más tiempo. Solo cuentan como vistas las que llegaron a servirse. Si no hay bastantes nuevas,
-- se completan con vistas, así que el historial nunca impide empezar una partida.
-- El historial es por cuenta (anfitrión): los invitados no tienen identidad propia entre partidas.

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
    where q.status = 'approved' and q.difficulty = match_difficulty
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

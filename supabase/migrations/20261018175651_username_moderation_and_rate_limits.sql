-- Fase 4: moderación de nombres de usuario y límites de peticiones en las operaciones sensibles.

-- Límites de peticiones ---------------------------------------------------------------------------
-- Ventana fija por usuario y acción. Al superarse, error con hint 'rate_limited' (el contador no sube más:
-- la excepción deshace el incremento).

create table public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  hits integer not null,
  primary key (user_id, action)
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create function public.check_rate_limit(limited_action text, max_hits integer, per interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  total integer;
begin
  -- Sin usuario (scripts con la clave secreta, tareas internas) no hay límite.
  if uid is null then
    return;
  end if;
  insert into public.rate_limits as r (user_id, action, window_start, hits)
  values (uid, limited_action, now(), 1)
  on conflict (user_id, action) do update
    set hits = case when r.window_start <= now() - per then 1 else r.hits + 1 end,
        window_start = case when r.window_start <= now() - per then now() else r.window_start end
  returning hits into total;
  if total > max_hits then
    raise exception 'demasiadas peticiones' using errcode = 'P0001', hint = 'rate_limited';
  end if;
end;
$$;

-- Para las altas: create trigger ... execute function public.rate_limit_trigger('<acción>', '<máximo>', '<ventana>').
create function public.rate_limit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_rate_limit(tg_argv[0], tg_argv[1]::integer, tg_argv[2]::interval);
  return new;
end;
$$;

create trigger friendships_rate_limit
  before insert on public.friendships
  for each row execute function public.rate_limit_trigger('friend_request', '20', '1 hour');

create trigger duels_rate_limit
  before insert on public.duels
  for each row execute function public.rate_limit_trigger('start_duel', '20', '1 hour');

create trigger quick_matches_rate_limit
  before insert on public.quick_matches
  for each row execute function public.rate_limit_trigger('start_quick_match', '60', '1 hour');

-- Moderación de nombres ---------------------------------------------------------------------------
-- Términos prohibidos en cualquier parte del nombre, comparados tras normalizarlo: minúsculas, sin "_" y con
-- los números que imitan letras (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, 8→b, 9→g). Se añaden con SQL.
-- shortcut: lista corta y por subcadena (puede bloquear algún nombre inocente; por eso se evitan términos como
-- "puta" o "culo", que aparecen en palabras comunes); ampliar con lo que se vea en la beta.

create table public.blocked_username_terms (
  term text primary key check (term ~ '^[a-z]{3,30}$')
);

alter table public.blocked_username_terms enable row level security;
revoke all on public.blocked_username_terms from anon, authenticated;

insert into public.blocked_username_terms (term) values
  -- Suplantación del equipo.
  ('admin'), ('moderador'), ('moderator'), ('soporte'), ('support'), ('staff'), ('oficial'), ('official'),
  ('triviaajolote'),
  -- Insultos, odio y contenido sexual (es).
  ('hijoputa'), ('hijodeputa'), ('puton'), ('putita'), ('gilipollas'), ('polla'), ('cabron'), ('maricon'),
  ('mierda'), ('joder'), ('follar'), ('subnormal'), ('retrasado'), ('sudaca'), ('negrata'), ('violador'),
  ('pederasta'), ('pedofilo'), ('zorra'), ('chupamela'),
  -- Insultos, odio y contenido sexual (en).
  ('fuck'), ('shit'), ('cunt'), ('nigger'), ('nigga'), ('faggot'), ('retard'), ('whore'), ('bitch'),
  ('slut'), ('rapist'), ('pedophile'), ('porn'), ('nazi'), ('hitler');

create function public.is_username_allowed(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.blocked_username_terms
    where translate(lower(candidate), '01345789_', 'oieastbg') like '%' || term || '%'
  );
$$;

-- Al crear el perfil o cambiar el nombre. Cambiarlo, como mucho 5 veces al día.
create function public.check_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.username is not distinct from old.username then
      return new;
    end if;
    perform public.check_rate_limit('change_username', 5, interval '1 day');
  end if;
  if not public.is_username_allowed(new.username) then
    raise exception 'nombre de usuario no permitido' using errcode = 'check_violation', hint = 'username_not_allowed';
  end if;
  return new;
end;
$$;

create trigger profiles_check_username
  before insert or update of username on public.profiles
  for each row execute function public.check_username();

-- RPC de consulta con límite: pasan a ser volatile (un límite escribe en rate_limits). --------------

-- Igual que en profiles, más el límite y los nombres no permitidos (la sugerencia del onboarding los evita).
create or replace function public.is_username_available(candidate text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.check_rate_limit('username_check', 30, interval '1 minute');
  return public.is_username_allowed(candidate) and not exists (
    select 1 from public.profiles
    where lower(username) = lower(candidate) and id <> (select auth.uid())
  );
end;
$$;

-- Igual que en friends_and_duels, más el límite (evita recorrer la lista de jugadores a base de búsquedas).
create or replace function public.search_players(query text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
  pattern text := lower(btrim(coalesce(query, '')));
begin
  if char_length(pattern) < 3 then
    return '[]'::jsonb;
  end if;
  perform public.check_rate_limit('search_players', 30, interval '1 minute');
  -- Los nombres solo admiten letras, números y _, pero el _ es comodín en LIKE: se escapa.
  pattern := replace(replace(replace(pattern, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  -- shortcut: LIKE por prefijo sobre lower(username) recorre la tabla; añadir un índice text_pattern_ops si crece.
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'username', s.username, 'avatarId', s.avatar_id, 'relation', s.relation
    ) order by lower(s.username))
    from (
      select p.id, p.username, p.avatar_id,
        case
          when f.status = 'accepted' then 'friend'
          when f.requester_id = uid then 'outgoing'
          when f.addressee_id = uid then 'incoming'
        end as relation
      from public.profiles as p
      left join public.friendships as f
        on (f.requester_id = uid and f.addressee_id = p.id) or (f.addressee_id = uid and f.requester_id = p.id)
      where p.id <> uid and lower(p.username) like pattern
      order by lower(p.username)
      limit 10
    ) as s
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.check_rate_limit(text, integer, interval) from public, anon, authenticated;
revoke execute on function public.rate_limit_trigger() from public, anon, authenticated;
revoke execute on function public.is_username_allowed(text) from public, anon, authenticated;
revoke execute on function public.check_username() from public, anon, authenticated;

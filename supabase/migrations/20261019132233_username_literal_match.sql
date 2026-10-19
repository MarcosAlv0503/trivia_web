-- Moderación de nombres (decidido el 2026-10-19): el término prohibido se busca tal cual, sin distinguir
-- mayúsculas. Ya no se quitan los "_" ni se cambian los números por letras: "El_m1erd4s" se admite, y cualquier
-- nombre que contenga literalmente "nazi" o "admin" (también "badminton") se rechaza.
create or replace function public.is_username_allowed(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.blocked_username_terms
    where lower(candidate) like '%' || term || '%'
  );
$$;

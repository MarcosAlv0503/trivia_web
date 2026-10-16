-- Invitados locales: jugadores sin cuenta (nombre y avatar) que pertenecen a la cuenta del anfitrión.
-- Solo se guardan para recordarlos en la próxima partida local: se conservan los 10 usados más recientemente.

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 1–20 caracteres sin espacios sobrantes; admite tildes y ñ (es un nombre local, no público).
  name text not null check (name = btrim(name) and char_length(name) between 1 and 20),
  avatar_id text not null references public.avatars (id),
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index guests_owner_name_key on public.guests (owner_id, lower(name));
create index guests_owner_last_used_idx on public.guests (owner_id, last_used_at desc);

alter table public.guests enable row level security;

create policy "guests: lectura de los propios"
  on public.guests for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "guests: borrado de los propios"
  on public.guests for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- Las altas y cambios pasan por remember_guest(); el cliente solo puede leer y borrar.
revoke all on public.guests from anon, authenticated;
grant select, delete on public.guests to authenticated;

-- Guarda (o refresca) un invitado y conserva solo los 10 más recientes del anfitrión.
create function public.remember_guest(guest_name text, guest_avatar_id text)
returns public.guests
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  saved public.guests;
begin
  if uid is null then
    raise exception 'no autenticado' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.avatars where id = guest_avatar_id and is_active) then
    raise exception 'avatar % no disponible', guest_avatar_id using errcode = 'check_violation';
  end if;

  -- clock_timestamp() (no now()) para ordenar bien varios invitados guardados en la misma transacción.
  insert into public.guests (owner_id, name, avatar_id, last_used_at)
  values (uid, btrim(guest_name), guest_avatar_id, clock_timestamp())
  on conflict (owner_id, lower(name)) do update
    set name = excluded.name, avatar_id = excluded.avatar_id, last_used_at = excluded.last_used_at
  returning * into saved;

  delete from public.guests
  where owner_id = uid
    and id not in (
      select id from public.guests where owner_id = uid order by last_used_at desc limit 10
    );

  return saved;
end;
$$;

revoke execute on function public.remember_guest(text, text) from public, anon;
grant execute on function public.remember_guest(text, text) to authenticated;

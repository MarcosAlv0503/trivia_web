-- Perfiles de usuario y catálogo de avatares.
-- El perfil se crea en el onboarding: un usuario sin fila en `profiles` aún no lo ha completado.

-- Catálogo de avatares: datos, no código, para poder añadir avatares (y en el futuro cosméticos) sin desplegar.
-- El dibujo de cada avatar vive en la web, indexado por `id`.
create table public.avatars (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.avatars enable row level security;

create policy "avatars: lectura de los activos"
  on public.avatars for select
  to authenticated
  using (is_active);

revoke all on public.avatars from anon, authenticated;
grant select on public.avatars to authenticated;

-- Set básico de avatares (datos de referencia necesarios también en producción, por eso van en la migración).
insert into public.avatars (id, sort_order) values
  ('axolotl-pink', 1),
  ('axolotl-gold', 2),
  ('axolotl-mint', 3),
  ('axolotl-sky', 4),
  ('axolotl-lilac', 5),
  ('axolotl-coral', 6),
  ('axolotl-pink-glasses', 7),
  ('axolotl-gold-bow', 8),
  ('axolotl-mint-cap', 9),
  ('axolotl-sky-glasses', 10),
  ('axolotl-lilac-bow', 11),
  ('axolotl-coral-cap', 12);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- 3–20 caracteres: letras sin tildes, números y guion bajo. Unicidad sin distinguir mayúsculas (índice abajo).
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  avatar_id text not null references public.avatars (id),
  locale text not null check (locale in ('es', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_username_lower_key on public.profiles (lower(username));

alter table public.profiles enable row level security;

-- De momento cada usuario solo ve su propio perfil.
create policy "profiles: lectura del propio"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles: creación del propio"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "profiles: edición del propio"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Solo las columnas editables por el usuario; el resto las gestiona la BD.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, username, avatar_id, locale) on public.profiles to authenticated;
grant update (username, avatar_id, locale) on public.profiles to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Los avatares inactivos (retirados) no se pueden elegir.
create function public.check_avatar_is_active()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.avatar_id is distinct from old.avatar_id)
     and not exists (select 1 from public.avatars where id = new.avatar_id and is_active) then
    raise exception 'avatar % no disponible', new.avatar_id using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_check_avatar_is_active
  before insert or update of avatar_id on public.profiles
  for each row execute function public.check_avatar_is_active();

-- Disponibilidad de un nombre de usuario sin exponer la tabla de perfiles.
create function public.is_username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles
    where lower(username) = lower(candidate) and id <> (select auth.uid())
  );
$$;

revoke execute on function public.is_username_available(text) from public, anon;
grant execute on function public.is_username_available(text) to authenticated;

-- Borrado de cuenta (RGPD / App Store): elimina el usuario de Auth y, en cascada, todos sus datos.
create function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = 'insufficient_privilege';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

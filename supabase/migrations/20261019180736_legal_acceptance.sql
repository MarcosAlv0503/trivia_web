-- Aceptación de los términos y la política de privacidad (incluye declarar la edad mínima) al crear el perfil.
-- Sirve de prueba de qué versión se aceptó y cuándo: la versión la envía la web y la fecha la pone la BD.
alter table public.profiles
  add column terms_version smallint not null default 1 check (terms_version > 0),
  add column terms_accepted_at timestamptz not null default now();

-- Sin valor por defecto: crear un perfil exige enviar la versión aceptada.
-- (Al migrar solo existen perfiles de desarrollo; esos quedan con la versión 1.)
alter table public.profiles alter column terms_version drop default;

-- `terms_accepted_at` no se concede: no se puede falsear ni editar desde el cliente.
grant insert (terms_version) on public.profiles to authenticated;

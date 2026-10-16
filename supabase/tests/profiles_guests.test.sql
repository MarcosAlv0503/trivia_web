-- RLS y permisos de perfiles, avatares e invitados. Se ejecuta con `pnpm db:test`; todo se deshace al final.
begin;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local');
insert into public.profiles (id, username, avatar_id, locale) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'axolotl-pink', 'es');

set local role anon;
select throws_ok('select * from public.profiles', '42501', null, 'anon no lee perfiles');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is((select count(*)::integer from public.profiles), 0, 'bob no ve el perfil de alice');
select is(
  (select count(*)::integer from public.avatars), 12, 'los avatares activos son visibles'
);
update public.profiles set username = 'pwned' where id = '00000000-0000-0000-0000-00000000000a';
reset role;
select is(
  (select username from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'alice',
  'bob no puede editar el perfil de alice'
);
set local role authenticated;
select throws_ok(
  $$ insert into public.profiles (id, username, avatar_id, locale)
     values ('00000000-0000-0000-0000-00000000000a', 'fake', 'axolotl-pink', 'es') $$,
  '42501', null, 'bob no puede crear un perfil con el id de otro'
);
select ok(not public.is_username_available('ALICE'), 'el nombre de usuario es único sin distinguir mayúsculas');
select lives_ok(
  $$ insert into public.profiles (id, username, avatar_id, locale)
     values ('00000000-0000-0000-0000-00000000000b', 'bob', 'axolotl-gold', 'en') $$,
  'bob crea su propio perfil'
);
select throws_ok(
  $$ update public.profiles set created_at = now() where id = '00000000-0000-0000-0000-00000000000b' $$,
  '42501', null, 'las columnas gestionadas por la BD no son editables'
);

-- Invitados: solo se crean con remember_guest y cada cuenta ve los suyos.
select throws_ok(
  $$ insert into public.guests (name, avatar_id) values ('Lucía', 'axolotl-mint') $$,
  '42501', null, 'no se insertan invitados directamente'
);
select public.remember_guest('Pepe', 'axolotl-sky');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::integer from public.guests), 0, 'alice no ve los invitados de bob');
select public.remember_guest('Invitado ' || i, 'axolotl-sky') from generate_series(1, 12) as i;
select is((select count(*)::integer from public.guests), 10, 'se conservan solo los 10 invitados más recientes');

select * from finish();
rollback;

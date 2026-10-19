-- Moderación de nombres de usuario y límites de peticiones. Se ejecuta con `pnpm db:test`; todo se deshace al final.
begin;
select plan(13);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'alice@test.local');

-- Nombres --------------------------------------------------------------------------------------------
select ok(public.is_username_allowed('Ajolote_99'), 'un nombre normal está permitido');
select ok(public.is_username_allowed('computadora'), 'no bloquea palabras comunes que contienen un insulto corto');
select ok(not public.is_username_allowed('MiErDa_total'), 'bloquea sin distinguir mayúsculas');
select ok(public.is_username_allowed('El_m1erd4s'), 'la comparación es literal: admite números que imitan letras');
select ok(not public.is_username_allowed('BadMinton'), 'y bloquea cualquier nombre que contenga el término tal cual');
select ok(not public.is_username_allowed('el_admin'), 'ni suplantar al equipo');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_like(
  $$ insert into public.profiles (id, username, avatar_id, locale)
     values ('00000000-0000-0000-0000-00000000000a', 'shit_lord', 'axolotl-pink', 'es') $$,
  'nombre de usuario no permitido', 'no se crea un perfil con un nombre prohibido'
);
insert into public.profiles (id, username, avatar_id, locale)
values ('00000000-0000-0000-0000-00000000000a', 'alice', 'axolotl-pink', 'es');
select throws_like(
  $$ update public.profiles set username = 'fuck_you' where id = '00000000-0000-0000-0000-00000000000a' $$,
  'nombre de usuario no permitido', 'ni se cambia a uno prohibido'
);
select is(public.is_username_available('cabron_1'), false, 'la sugerencia del onboarding evita los prohibidos');

-- Límites --------------------------------------------------------------------------------------------
update public.profiles set username = 'alice_1' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'alice_2' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'alice_3' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'alice_4' where id = '00000000-0000-0000-0000-00000000000a';
select lives_ok(
  $$ update public.profiles set username = 'alice_5' where id = '00000000-0000-0000-0000-00000000000a' $$,
  'cinco cambios de nombre al día'
);
select throws_like(
  $$ update public.profiles set username = 'alice_6' where id = '00000000-0000-0000-0000-00000000000a' $$,
  'demasiadas peticiones', 'el sexto se rechaza'
);
select lives_ok(
  $$ update public.profiles set avatar_id = 'axolotl-gold' where id = '00000000-0000-0000-0000-00000000000a' $$,
  'cambiar otras cosas del perfil no cuenta'
);

select public.search_players('ali') from generate_series(1, 30);
select throws_like($$ select public.search_players('ali') $$, 'demasiadas peticiones', 'como mucho 30 búsquedas por minuto');

select * from finish();
rollback;

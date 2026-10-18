-- Fase 4: avisos push web (PWA) cuando te toca en un duelo y cuando el plazo del turno está a punto de vencer.
-- Flujo: inserción en notifications → trigger → pg_net (asíncrono, tras el commit) → Edge Function `push`,
-- que envía el aviso a cada dispositivo suscrito. Sin los secretos del Vault (CI, entornos sin configurar), no
-- se envía nada y el resto funciona igual.

create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

-- Aviso nuevo: el plazo del turno vence pronto.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('friend_request', 'friend_accepted', 'duel_turn', 'duel_finished', 'duel_deadline'));

-- Último turno del que ya se avisó que vence (un aviso por turno).
alter table public.duels add column deadline_warned_turn smallint;

-- Suscripciones ------------------------------------------------------------------------------------

create table public.push_subscriptions (
  -- URL del servicio push del navegador: identifica al dispositivo.
  endpoint text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  created_at timestamptz not null default clock_timestamp()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id, created_at);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Un dispositivo pasa a la cuenta que lo registra (navegador compartido); como mucho 10 por cuenta.
create function public.save_push_subscription(sub_endpoint text, sub_p256dh text, sub_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.current_player_id();
begin
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (sub_endpoint, uid, sub_p256dh, sub_auth)
  on conflict (endpoint) do update
    set user_id = uid, p256dh = excluded.p256dh, auth = excluded.auth, created_at = clock_timestamp();
  delete from public.push_subscriptions
  where user_id = uid and endpoint not in (
    select endpoint from public.push_subscriptions where user_id = uid order by created_at desc limit 10
  );
end;
$$;

create function public.delete_push_subscription(sub_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = sub_endpoint and user_id = (select auth.uid());
$$;

-- Envío --------------------------------------------------------------------------------------------
-- Secretos en el Vault (README > "Avisos push"): URL de la función y secreto compartido con ella.

create function public.send_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  function_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'push_function_url');
  webhook_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret');
begin
  if function_url is null or webhook_secret is null
     or not exists (select 1 from public.push_subscriptions where user_id = new.user_id) then
    return new;
  end if;
  perform net.http_post(
    url := function_url,
    body := jsonb_build_object(
      'userId', new.user_id,
      'kind', new.kind,
      'actorName', new.actor_name,
      'duelId', new.duel_id,
      'locale', (select locale from public.profiles where id = new.user_id)
    ),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || webhook_secret)
  );
  return new;
end;
$$;

create trigger notifications_send_push
  after insert on public.notifications
  for each row
  when (new.kind in ('duel_turn', 'duel_deadline'))
  execute function public.send_push();

-- Plazo a punto de vencer --------------------------------------------------------------------------
-- Cada 15 min: a quien le toca en un duelo cuyo turno vence en menos de 6 h se le avisa una vez por turno.

create function public.warn_duel_deadlines()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
  total integer := 0;
begin
  for d in
    update public.duels
    set deadline_warned_turn = turn_number
    where status = 'active'
      and turn_deadline between now() and now() + interval '6 hours'
      and deadline_warned_turn is distinct from turn_number
    returning id,
      case when turn_number % 2 = 1 then challenger_id else opponent_id end as player,
      case when turn_number % 2 = 1 then opponent_id else challenger_id end as rival
  loop
    perform public.notify(d.player, 'duel_deadline', d.rival, d.id);
    total := total + 1;
  end loop;
  return total;
end;
$$;

select cron.schedule('warn-duel-deadlines', '*/15 * * * *', 'select public.warn_duel_deadlines()');

revoke execute on function public.send_push() from public, anon, authenticated;
revoke execute on function public.warn_duel_deadlines() from public, anon, authenticated;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
revoke execute on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;

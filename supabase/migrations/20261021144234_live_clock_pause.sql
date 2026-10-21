-- Duelo relámpago: el reloj del jugador se para solo lo que tarda de verdad entre responder y recibir la siguiente
-- pregunta (el destello y la petición), con un máximo de 1 s por respuesta. Antes devolvía 1 s fijo, que a quien
-- responde muy rápido le dejaba el reloj casi parado.

create or replace function public.live_clock_end(d public.live_duels, player uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  -- Pausa de cada respuesta dada a tiempo: hasta que se sirvió la siguiente (o hasta ahora, si aún no), máx. 1 s.
  select d.starts_at + interval '60 seconds' + coalesce(sum(
    least(interval '1 second', greatest(interval '0', coalesce(n.served_at, clock_timestamp()) - a.answered_at))
  ), interval '0')
  from public.live_duel_answers as a
  left join public.live_duel_answers as n
    on n.duel_id = a.duel_id and n.player_id = a.player_id and n.position = a.position + 1
  where a.duel_id = d.id and a.player_id = player and a.credited;
$$;

revoke execute on function public.live_clock_end(public.live_duels, uuid) from public, anon, authenticated;

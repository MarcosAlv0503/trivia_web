-- La partida rápida da la mitad de XP para favorecer los duelos: mitad de los puntos del anfitrión (redondeando
-- hacia abajo) + 10. El duelo no cambia. La XP ya sumada se conserva.
create or replace function public.quick_match_grant_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.grant_xp(new.owner_id, 10 + coalesce((
    select sum(r.points)::integer from public.quick_match_rounds as r
    where r.match_id = new.id and r.position % new.player_count = 0
  ), 0) / 2, new.id, null);
  return null;
end;
$$;

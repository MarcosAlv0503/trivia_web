import { redirect } from "next/navigation";
import { DailyResults } from "@/features/daily/daily-results";
import type { Daily } from "@/features/daily/types";
import { QuickGame } from "@/features/game/quick/quick-game";
import { getAuthContext, requireProfile } from "@/features/profile/queries";

/** El reto de hoy: se juega aquí y, al terminar, aquí mismo se ve el resultado. Se empieza desde la portada. */
export default async function DailyPage() {
  await requireProfile();
  const { supabase } = await getAuthContext();
  const { data } = await supabase.rpc("get_daily");
  const daily = data as unknown as Daily | null;
  if (!daily?.match) redirect("/");
  if (!daily.match.finished)
    return <QuickGame key={daily.match.id} matchId={daily.match.id} daily />;
  return <DailyResults daily={daily} match={daily.match} />;
}

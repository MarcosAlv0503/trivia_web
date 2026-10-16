import { QuickGame } from "@/features/game/quick/quick-game";
import { requireProfile } from "@/features/profile/queries";

export default async function QuickMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  await requireProfile();
  const { matchId } = await params;
  // key: la revancha navega a otra partida y debe empezar con el estado limpio.
  return <QuickGame key={matchId} matchId={matchId} />;
}

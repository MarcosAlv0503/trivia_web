import { DuelGame } from "@/features/duel/duel-game";
import { requireProfile } from "@/features/profile/queries";

export default async function DuelPage({ params }: { params: Promise<{ duelId: string }> }) {
  await requireProfile();
  const { duelId } = await params;
  // key: la revancha navega a otro duelo y debe empezar con el estado limpio.
  return <DuelGame key={duelId} duelId={duelId} />;
}

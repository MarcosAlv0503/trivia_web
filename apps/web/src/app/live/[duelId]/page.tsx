import { LiveGame } from "@/features/live/live-game";
import { requireProfile } from "@/features/profile/queries";

export default async function LiveDuelPage({ params }: { params: Promise<{ duelId: string }> }) {
  await requireProfile();
  const { duelId } = await params;
  return <LiveGame key={duelId} duelId={duelId} />;
}

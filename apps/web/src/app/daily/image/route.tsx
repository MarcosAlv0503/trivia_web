import { getTranslations } from "next-intl/server";
import { dailyImage } from "@/features/daily/daily-image";
import type { Daily } from "@/features/daily/types";
import { getAuthContext } from "@/features/profile/queries";

/** Imagen para compartir el resultado del reto de hoy (solo el propio y ya terminado). */
export async function GET() {
  const { supabase } = await getAuthContext();
  const { data } = await supabase.rpc("get_daily");
  const daily = data as unknown as Daily | null;
  const match = daily?.match;
  if (!daily || !match?.finished) return new Response(null, { status: 404 });
  const t = await getTranslations("Daily");
  return dailyImage({
    title: t("title", { number: daily.number }),
    result: t("result", {
      correct: match.correct,
      total: match.rounds.length,
      points: match.score,
    }),
    rounds: match.rounds,
  });
}

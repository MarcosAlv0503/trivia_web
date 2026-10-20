import { useTranslations } from "next-intl";
import { levelProgress } from "@trivia/game-core";

/** Insignia con el nivel, junto al nombre de un jugador. */
export function LevelBadge({ xp }: { xp: number }) {
  const t = useTranslations("Progress");
  const { level } = levelProgress(xp);
  return (
    <span className="shrink-0 rounded-full bg-play px-2 py-0.5 font-display text-xs font-bold text-ink">
      <span aria-hidden="true">{t("levelShort", { level })}</span>
      <span className="sr-only">{t("level", { level })}</span>
    </span>
  );
}

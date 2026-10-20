import { useTranslations } from "next-intl";
import { levelProgress, titleLevel } from "@trivia/game-core";
import { XpBar } from "./xp-bar";

/** Nivel, título y barra de XP del jugador (portada y perfil). */
export function LevelCard({ xp }: { xp: number }) {
  const t = useTranslations("Progress");
  const { level, current, needed } = levelProgress(xp);
  return (
    <section className="flex w-full flex-col gap-2 rounded-card bg-surface p-4 sticker">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold">{t("level", { level })}</h2>
        <span className="text-right font-bold text-fg-muted">
          {t(`titles.${titleLevel(level)}`)}
        </span>
      </div>
      <XpBar to={current / needed} label={t("barLabel", { next: level + 1 })} />
      <span className="self-end text-sm font-bold text-fg-muted tabular-nums">
        {t("xp", { current, needed })}
      </span>
    </section>
  );
}

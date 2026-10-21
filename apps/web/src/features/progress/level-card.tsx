import { useTranslations } from "next-intl";
import { levelProgress, titleLevel } from "@trivia/game-core";
import { TitleIcon } from "@/components/title-icon";
import { XpBar } from "./xp-bar";

/** Nivel, título (con su icono) y barra de XP del jugador, en el perfil. */
export function LevelCard({ xp }: { xp: number }) {
  const t = useTranslations("Progress");
  const { level, current, needed } = levelProgress(xp);
  return (
    <section className="flex w-full flex-col gap-2 rounded-card bg-surface p-4 sticker">
      <div className="flex items-center gap-3">
        <TitleIcon level={titleLevel(level)} size={52} className="shrink-0" />
        <div className="flex flex-col">
          <h2 className="text-xl font-bold">{t("level", { level })}</h2>
          <span className="font-bold text-fg-muted">{t(`titles.${titleLevel(level)}`)}</span>
        </div>
      </div>
      <XpBar to={current / needed} label={t("barLabel", { next: level + 1 })} />
      <span className="self-end text-sm font-bold text-fg-muted tabular-nums">
        {t("xp", { current, needed })}
      </span>
    </section>
  );
}

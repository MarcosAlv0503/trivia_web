"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { levelProgress, titleLevel } from "@trivia/game-core";
import { playSound } from "@/features/game/sfx";
import { XpBar } from "./xp-bar";

export type XpGained = { gained: number; total: number };

// Momentos de la animación (s): aparece "+N XP", se llena la barra y, si se sube, cae la pegatina.
const GAINED_AT = 0.4;
const BAR_AT = 0.6;
const LEVEL_UP_AT = 1.3;

/** XP ganada en la partida, con la barra llenándose y la pegatina de subida de nivel. */
export function XpGain({ gained, total }: XpGained) {
  const t = useTranslations("Progress");
  const reduceMotion = useReducedMotion();
  const before = levelProgress(total - gained);
  const after = levelProgress(total);
  const leveledUp = after.level > before.level;
  const newTitle = titleLevel(after.level) !== titleLevel(before.level);

  useEffect(() => {
    if (!leveledUp) return;
    const timer = setTimeout(() => playSound("levelUp"), LEVEL_UP_AT * 1000);
    return () => clearTimeout(timer);
  }, [leveledUp]);

  return (
    <section className="flex w-full flex-col gap-2 rounded-card bg-surface p-4 sticker">
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-lg font-bold">{t("level", { level: after.level })}</span>
        <motion.span
          className="rounded-full bg-play px-3 py-0.5 font-display font-bold text-ink sticker"
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: GAINED_AT, type: "spring", bounce: 0.5 }}
        >
          {t("gained", { xp: gained })}
        </motion.span>
      </div>
      {/* Al subir de nivel, la barra del nivel nuevo se llena desde cero. */}
      <XpBar
        from={leveledUp ? 0 : before.current / before.needed}
        to={after.current / after.needed}
        label={t("barLabel", { next: after.level + 1 })}
        delay={BAR_AT}
      />
      {leveledUp && (
        <div aria-live="polite" className="flex flex-col items-center gap-1 pt-2">
          {/* Misma entrada de sello que las pegatinas de acierto y fallo. */}
          <motion.p
            className="rounded-full bg-accent px-5 py-1.5 font-display text-2xl font-bold text-accent-ink sticker"
            initial={{ opacity: 0, y: reduceMotion ? 0 : -28, scale: reduceMotion ? 1 : 0.7 }}
            animate={
              reduceMotion
                ? { opacity: 1 }
                : {
                    opacity: [0, 1, 1, 1],
                    y: [-28, 4, 0, 0],
                    scale: [0.7, 1.08, 0.95, 1],
                    rotate: [0, -3, 2, 0],
                  }
            }
            transition={{ delay: LEVEL_UP_AT, duration: 0.45, times: [0, 0.35, 0.65, 1] }}
          >
            {t("levelUp", { level: after.level })}
          </motion.p>
          {newTitle && (
            <motion.p
              className="font-bold text-fg-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: LEVEL_UP_AT + 0.4 }}
            >
              {t("newTitle", { title: t(`titles.${titleLevel(after.level)}`) })}
            </motion.p>
          )}
        </div>
      )}
    </section>
  );
}

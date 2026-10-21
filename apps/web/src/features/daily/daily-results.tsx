"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { BackLink } from "@/components/back-link";
import { Mascot } from "@/components/mascot";
import { useOutcomeOnce } from "@/features/game/match-outcome";
import { playSound } from "@/features/game/sfx";
import { Avatar } from "@/features/profile/avatar";
import { LevelBadge } from "@/features/progress/level-badge";
import { XpGain } from "@/features/progress/xp-gain";
import { DailySquares } from "./daily-squares";
import { ShareButton } from "./share-button";
import type { Daily } from "./types";

/** Pantalla del reto terminado: tus cuadritos, puntos y XP, tus amigos de hoy y compartir. */
export function DailyResults({
  daily,
  match,
}: {
  daily: Daily;
  match: NonNullable<Daily["match"]>;
}) {
  const t = useTranslations("Daily");
  const total = match.rounds.length;
  // El sonido de final, solo la primera vez que se ve (al terminar), no cada vez que se vuelve a mirar.
  const { showing, dismiss } = useOutcomeOnce(`daily:${match.id}`);
  useEffect(() => {
    if (!showing) return;
    playSound("win");
    dismiss();
  }, [showing, dismiss]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <BackLink href="/" label={t("back")} />
        <h1 className="text-3xl font-bold">{t("title", { number: daily.number })}</h1>
      </div>

      <div className="flex flex-col items-center gap-4">
        <motion.div
          initial={{ scale: 0.5, rotate: -10, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="drop-shadow-[0_6px_0_var(--color-sticker)]"
        >
          <Mascot size={110} />
        </motion.div>
        <DailySquares rounds={match.rounds} size={42} />
        <p className="font-display text-2xl font-bold">
          {t("result", { correct: match.correct, total, points: match.score })}
        </p>
        {match.xp && <XpGain {...match.xp} />}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">{t("friendsTitle")}</h2>
        {daily.friends.length === 0 ? (
          <p className="font-bold text-fg-muted">{t("noFriends")}</p>
        ) : (
          <ol className="grid gap-2">
            {daily.friends.map((friend) => (
              <li
                key={friend.id}
                className="flex items-center gap-3 rounded-2xl bg-surface p-2 pr-4 sticker"
              >
                <Avatar id={friend.avatarId} size={44} />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-display text-lg font-bold">
                      {friend.username}
                    </span>
                    <LevelBadge xp={friend.xp} />
                  </span>
                  <DailySquares rounds={friend.rounds} size={20} />
                </div>
                <span className="ml-auto font-display text-xl font-bold">
                  {t("points", { points: friend.score })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-auto">
        <ShareButton
          number={daily.number}
          correct={match.correct}
          total={total}
          points={match.score}
        />
      </div>
    </main>
  );
}

"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { legendaryThreshold, localOutcome, rankPlayers } from "@trivia/game-core";
import { buttonClassName } from "@/components/button";
import { Mascot } from "@/components/mascot";
import { MatchOutcome, useOutcomeOnce } from "@/features/game/match-outcome";
import { playSound } from "@/features/game/sfx";
import { Avatar } from "@/features/profile/avatar";
import { XpGain } from "@/features/progress/xp-gain";
import { startQuickMatch, type StartState } from "./actions";
import type { QuickMatch } from "./types";

const PLACE_STYLES = ["bg-play text-ink", "bg-surface-2", "bg-surface-2"];

export function QuickResults({ match }: { match: QuickMatch }) {
  const t = useTranslations("Quick");
  const [state, formAction, pending] = useActionState<StartState, FormData>(startQuickMatch, {});
  const ranked = rankPlayers(match.players);
  const perPlayer = match.total / match.players.length;
  // En local, animación de victoria (o empate en cabeza); en solitario, el sonido de siempre.
  const outcome = localOutcome(match.players, legendaryThreshold(perPlayer));
  const solo = outcome === null;
  const { showing, afterOutcome, dismiss } = useOutcomeOnce(solo ? null : `quick:${match.id}`);
  useEffect(() => {
    if (solo) playSound("win");
  }, [solo]);
  const winners = ranked.filter((p) => p.place === 1);
  const heading =
    match.players.length === 1
      ? t("finished")
      : winners.length > 1
        ? t("tie")
        : t("winner", { name: winners[0]!.name });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 sm:p-6">
      {outcome && showing && (
        <MatchOutcome
          kind={outcome.kind}
          names={outcome.winners.map((p) => p.name)}
          onDone={dismiss}
        />
      )}
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <motion.div
          initial={{ scale: 0.5, rotate: -10, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="drop-shadow-[0_6px_0_var(--color-sticker)]"
        >
          <Mascot size={120} />
        </motion.div>
        <h1 className="text-center text-4xl font-bold">{heading}</h1>

        <ol className="grid w-full gap-2" aria-label={t("results")}>
          {ranked.map((p, i) => (
            <motion.li
              key={p.seat}
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="flex items-center gap-3 rounded-2xl bg-surface p-2 pr-4 sticker"
            >
              {match.players.length > 1 && (
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full font-display text-lg font-bold ${
                    PLACE_STYLES[p.place - 1] ?? "bg-surface"
                  }`}
                >
                  {p.place}
                </span>
              )}
              <Avatar id={p.avatarId} size={44} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-display text-lg font-bold">{p.name}</span>
                <span className="text-sm text-fg-muted">
                  {t("correctCount", { count: p.correct, total: perPlayer })}
                </span>
              </div>
              <span className="ml-auto font-display text-2xl font-bold">
                {t("score", { points: p.score })}
              </span>
            </motion.li>
          ))}
        </ol>
        {/* Después de la animación: la subida de nivel tiene su propia pegatina y sonido. */}
        {match.xp && (solo || afterOutcome) && <XpGain {...match.xp} />}
      </div>

      {state.error && (
        <p role="alert" className="font-bold text-ko">
          {t(`errors.${state.error}`)}
        </p>
      )}

      <div className="flex w-full gap-3">
        {/* Revancha: mismos jugadores (en el mismo orden) y misma dificultad. */}
        <form action={formAction} className="flex-1">
          <input type="hidden" name="difficulty" value={match.difficulty} />
          {match.players
            .filter((p) => p.seat > 0)
            .map((p) => (
              <span key={p.seat}>
                <input type="hidden" name="guestName" value={p.name} />
                <input type="hidden" name="guestAvatar" value={p.avatarId} />
              </span>
            ))}
          <button type="submit" disabled={pending} className={buttonClassName("play", "w-full")}>
            {pending ? t("starting") : t("rematch")}
          </button>
        </form>
        <Link href="/" className={buttonClassName("secondary", "py-3.5")}>
          {t("home")}
        </Link>
      </div>
    </main>
  );
}

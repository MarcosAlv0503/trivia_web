"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import {
  DUEL,
  duelPendingRound,
  headToHeadOutcome,
  hoursLeft,
  legendaryThreshold,
} from "@trivia/game-core";
import { buttonClassName } from "@/components/button";
import { Mascot } from "@/components/mascot";
import { QuestionCard } from "@/components/question-card";
import { BackLink } from "@/components/back-link";
import { CategoryIcon } from "@/components/category-icon";
import { Wheel } from "@/components/wheel";
import { AnswerFeedback } from "@/features/game/answer-feedback";
import { MatchOutcome, useOutcomeOnce } from "@/features/game/match-outcome";
import { playSound } from "@/features/game/sfx";
import { ReportQuestion, type ReportReason } from "@/features/game/report-question";
import { useQuestionTimer } from "@/features/game/use-question-timer";
import {
  NOTIFICATION_EVENT,
  type NotificationRow,
} from "@/features/notifications/notification-toasts";
import { Avatar } from "@/features/profile/avatar";
import { LevelBadge } from "@/features/progress/level-badge";
import { XpGain } from "@/features/progress/xp-gain";
import { createClient } from "@/lib/supabase/client";
import { startDuel } from "./start-duel";
import type { Duel, DuelAnswerResult, DuelPlayer, DuelQuestion } from "./types";
import { DuelIcon, WhiteFlagIcon } from "@/components/icons";

// Pausa para ver la categoría que ha salido antes de la primera pregunta.
const AFTER_SPIN_MS = 900;

type Phase = "loading" | "overview" | "spinning" | "question" | "reveal" | "error";
type ErrorKey = "notFound" | "notFriends" | "tooManyDuels" | "notEnoughQuestions" | "generic";

/** Conduce el duelo: el servidor decide categoría, preguntas, puntos y turnos; aquí solo se muestra. */
export function DuelGame({ duelId }: { duelId: string }) {
  const t = useTranslations("Duel");
  const tGame = useTranslations("Quick");
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [phase, setPhase] = useState<Phase>("loading");
  const [duel, setDuel] = useState<Duel | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState<ErrorKey>("generic");
  const [actionError, setActionError] = useState<ErrorKey>();
  const [spinTarget, setSpinTarget] = useState<number | null>(null);
  const [question, setQuestion] = useState<DuelQuestion | null>(null);
  const [chosen, setChosen] = useState<number>();
  const [result, setResult] = useState<DuelAnswerResult | null>(null);
  const [busy, setBusy] = useState(false);
  const answering = useRef(false);

  function fail(key: ErrorKey) {
    setError(key);
    setPhase("error");
  }

  async function loadDuel() {
    const { data, error } = await supabase.rpc("get_duel", { duel_id: duelId });
    if (error || !data) {
      fail(error && error.code !== "22P02" ? "generic" : "notFound");
      return null;
    }
    const loaded = data as unknown as Duel;
    setDuel(loaded);
    setLoadedAt(Date.now());
    return loaded;
  }

  async function showOverview() {
    if (await loadDuel()) setPhase("overview");
  }

  async function serve() {
    const { data, error } = await supabase.rpc("serve_duel_question", { duel_id: duelId });
    if (error || !data) return fail("generic");
    answering.current = false;
    setQuestion(data as unknown as DuelQuestion);
    setChosen(undefined);
    setResult(null);
    setPhase("question");
  }

  async function spin() {
    if (!duel) return;
    setActionError(undefined);
    setSpinTarget(null);
    setPhase("spinning");
    const { data, error } = await supabase.rpc("spin_duel_round", { duel_id: duelId });
    if (error || !data) {
      setActionError(error?.hint === "not_enough_questions" ? "notEnoughQuestions" : "generic");
      return showOverview();
    }
    const { categoryId } = data as unknown as { categoryId: string };
    setSpinTarget(duel.categories.findIndex((c) => c.id === categoryId));
    playSound("spin");
  }

  async function answer(choice: number | null) {
    if (!question || answering.current) return;
    answering.current = true;
    if (choice !== null) setChosen(choice);
    const { data, error } = await supabase.rpc("answer_duel_question", {
      duel_id: duelId,
      question_round: question.round,
      question_slot: question.slot,
      // null = tiempo agotado (los tipos generados no admiten null en argumentos de RPC).
      choice: choice as number,
    });
    if (error || !data) return fail("generic");
    setResult(data as unknown as DuelAnswerResult);
    setPhase("reveal");
  }

  async function report(reason: ReportReason) {
    if (!question) return false;
    const { error } = await supabase.rpc("report_duel_question", {
      duel_id: duelId,
      question_round: question.round,
      question_slot: question.slot,
      reason,
    });
    return !error;
  }

  async function runAction(action: "surrender_duel" | "decline_duel") {
    setBusy(true);
    const { error } = await supabase.rpc(action, { duel_id: duelId });
    if (error) setActionError("generic");
    await showOverview();
    setBusy(false);
  }

  async function rematch() {
    if (!duel) return;
    setBusy(true);
    const started = await startDuel(supabase, duel.opponent.id, duel.difficulty, duel.roundCount);
    if ("id" in started) {
      router.push(`/duel/${started.id}`);
      return;
    }
    setActionError(started.error);
    setBusy(false);
  }

  const start = useEffectEvent(() => showOverview());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el estado cambia tras la respuesta de red, no en el mismo render
    void start();
  }, []);

  // Si el rival termina su turno mientras miras el duelo, se actualiza solo.
  const onNotification = useEffectEvent((row: NotificationRow) => {
    if (row.duel_id === duelId && phase === "overview") void loadDuel();
  });
  useEffect(() => {
    const listener = (e: Event) => onNotification((e as CustomEvent<NotificationRow>).detail);
    window.addEventListener(NOTIFICATION_EVENT, listener);
    return () => window.removeEventListener(NOTIFICATION_EVENT, listener);
  }, []);

  // Final con animación (una vez por dispositivo); un duelo cancelado o rechazado no la tiene.
  const decided =
    phase === "overview" &&
    duel?.status === "finished" &&
    duel.result &&
    duel.result !== "cancelled"
      ? duel.result
      : null;
  const outcomeShown = useOutcomeOnce(decided ? `duel:${duelId}` : null);

  // El reloj se para al elegir (sin esperar a la respuesta del servidor).
  const timeLeftMs = useQuestionTimer(
    question,
    phase === "question" && chosen === undefined,
    () => void answer(null),
  );

  // Tras ver la correcta, el jugador avanza cuando quiere ("Siguiente"); servir es idempotente.
  async function next() {
    const loaded = await loadDuel();
    if (!loaded) return;
    if (loaded.nextAction === "answer") return serve();
    setPhase("overview");
  }

  if (phase === "error") {
    return (
      <Centered>
        <Mascot size={110} />
        <p role="alert" className="text-center text-lg font-bold">
          {t(`errors.${error}`)}
        </p>
        <Link href="/" className={buttonClassName("secondary")}>
          {t("home")}
        </Link>
      </Centered>
    );
  }

  if (phase === "loading" || !duel) {
    return (
      <Centered>
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Mascot size={110} />
        </motion.div>
      </Centered>
    );
  }

  if (phase === "spinning") {
    const landed = spinTarget === null ? null : duel.categories[spinTarget];
    return (
      <Centered>
        <p className="font-bold text-fg-muted">
          {t("roundOf", { round: duel.turnNumber, total: duel.roundCount })}
        </p>
        <Wheel
          segments={duel.categories.map((c) => ({ id: c.id, color: c.color }))}
          target={spinTarget}
          onSpinEnd={() => setTimeout(() => void serve(), AFTER_SPIN_MS)}
        />
        <p aria-live="polite" className="min-h-9 font-display text-2xl font-bold">
          {landed?.name}
        </p>
      </Centered>
    );
  }

  if ((phase === "question" || phase === "reveal") && question) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="font-bold text-fg-muted">
            {t("roundOf", { round: question.round, total: duel.roundCount })}
          </span>
          <span className="flex items-center gap-2 font-display font-bold">
            {t("you")} {duel.me.score} · {duel.opponent.score}
            <Avatar id={duel.opponent.avatarId} size={32} />
          </span>
        </div>
        <QuestionCard
          category={{
            id: question.category.id,
            label: question.category.name,
            color: question.category.color,
          }}
          badge={question.topical ? tGame("topical") : undefined}
          question={question.prompt}
          answers={question.answers.map((text, i) => ({ id: String(i), text }))}
          timeLeft={timeLeftMs / question.timeLimitMs}
          timeLimitMs={question.timeLimitMs}
          selectedId={chosen === undefined ? undefined : String(chosen)}
          correctId={result ? String(result.correctIndex) : undefined}
          onAnswer={(id) => void answer(Number(id))}
          timerLabel={t("roundOf", { round: question.round, total: duel.roundCount })}
        />
        <AnswerFeedback result={result} timedOut={chosen === undefined} />
        {phase === "reveal" && (
          <div className="mt-auto flex flex-col gap-3">
            <ReportQuestion key={`${question.round}-${question.slot}`} onReport={report} />
            <button
              type="button"
              autoFocus
              onClick={() => void next()}
              className={buttonClassName("play", "w-full")}
            >
              {tGame("next")}
            </button>
          </div>
        )}
      </main>
    );
  }

  // Resumen del duelo.
  const active = duel.status === "active";
  const rounds = Array.from({ length: duel.roundCount }, (_, i) =>
    duel.rounds.find((r) => r.round === i + 1),
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4 sm:p-6">
      {decided && outcomeShown.showing && (
        <MatchOutcome
          kind={headToHeadOutcome(
            decided,
            duel.me.score,
            legendaryThreshold(duel.roundCount * DUEL.questionsPerRound),
          )}
          onDone={outcomeShown.dismiss}
        />
      )}
      <DuelHeader
        canSurrender={active}
        busy={busy}
        onSurrender={() => void runAction("surrender_duel")}
      />

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-card bg-surface p-4 sticker">
        <PlayerScore name={t("you")} player={duel.me} />
        <DuelIcon size={40} />
        <PlayerScore name={duel.opponent.username} player={duel.opponent} />
      </div>

      <ol className="grid gap-1.5">
        {rounds.map((round, i) => (
          <li
            key={i}
            className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 rounded-2xl bg-surface px-3 py-2"
          >
            <span className="font-display font-bold text-fg-muted">
              {t("round", { round: i + 1 })}
            </span>
            {round ? (
              <span className="flex items-center gap-2 font-bold">
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-sticker text-ink"
                  style={{ backgroundColor: round.category.color }}
                >
                  <CategoryIcon id={round.category.id} size={16} />
                </span>
                {round.category.name}
              </span>
            ) : (
              <span />
            )}
            {round && (
              <span className="font-display font-bold tabular-nums">
                {round.myPoints ?? "—"} · {round.opponentPoints ?? "—"}
              </span>
            )}
          </li>
        ))}
      </ol>

      {actionError && (
        <p role="alert" className="text-center font-bold text-ko">
          {t(`errors.${actionError}`, { max: DUEL.maxActivePerPair })}
        </p>
      )}

      {(duel.nextAction === "wait" || (!active && duel.result)) && (
        <div className="flex flex-col items-center gap-3">
          {duel.nextAction === "wait" && (
            <p className="text-center font-bold text-fg-muted">
              {t("waiting", {
                name: duel.opponent.username,
                hours: hoursLeft(new Date(duel.deadline), new Date(loadedAt)),
              })}
            </p>
          )}
          {!active && duel.result && (
            <>
              <motion.h1
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center text-4xl font-bold"
              >
                {t(duel.result)}
              </motion.h1>
              {duel.endReason && duel.endReason !== "completed" && (
                <p className="text-fg-muted">{t(`reasons.${duel.endReason}`)}</p>
              )}
              {duel.xpGain && (!decided || outcomeShown.afterOutcome) && (
                <XpGain {...duel.xpGain} />
              )}
            </>
          )}
        </div>
      )}

      {/* Acciones, abajo (a mano del pulgar). */}
      <div className="mt-auto flex flex-col gap-3">
        {duel.canDecline && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void runAction("decline_duel")}
            className={buttonClassName("secondary")}
          >
            {t("decline")}
          </button>
        )}
        {duel.nextAction === "spin" && (
          <button
            type="button"
            onClick={() => void spin()}
            className={buttonClassName("play", "w-full")}
          >
            {t("spin")}
          </button>
        )}
        {duel.nextAction === "answer" && (
          <button
            type="button"
            onClick={() => void serve()}
            className={buttonClassName("play", "w-full")}
          >
            {t("play", { round: duelPendingRound(duel.turnNumber, duel.rounds.length) })}
          </button>
        )}
        {!active && duel.result && (
          <div className="flex w-full gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void rematch()}
              className={buttonClassName("play", "flex-1")}
            >
              {t("rematch")}
            </button>
            <Link href="/" className={buttonClassName("secondary", "py-3.5")}>
              {t("home")}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 p-4 sm:p-6">
      {children}
    </main>
  );
}

function PlayerScore({ name, player }: { name: string; player: DuelPlayer }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <Avatar id={player.avatarId} size={56} />
      <span className="max-w-full truncate font-bold">{name}</span>
      <LevelBadge xp={player.xp} />
      <span className="font-display text-2xl font-bold tabular-nums">{player.score}</span>
    </div>
  );
}

/** Volver y "Rendirse" (con confirmación: cuenta como derrota). */
function DuelHeader({
  canSurrender,
  busy,
  onSurrender,
}: {
  canSurrender: boolean;
  busy: boolean;
  onSurrender: () => void;
}) {
  const t = useTranslations("Duel");
  const [confirming, setConfirming] = useState(false);

  if (confirming && canSurrender) {
    return (
      <div className="flex flex-col gap-3 rounded-card bg-surface p-4 sticker">
        <p className="font-bold">{t("surrenderConfirm")}</p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onSurrender}
            className={buttonClassName("danger")}
          >
            {t("surrenderYes")}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className={buttonClassName("secondary")}
          >
            {t("keepPlaying")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <BackLink href="/" label={t("back")} />
      {canSurrender && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={buttonClassName("secondary", "gap-2 px-4 py-2 text-base")}
        >
          <WhiteFlagIcon size={20} />
          {t("surrender")}
        </button>
      )}
    </div>
  );
}

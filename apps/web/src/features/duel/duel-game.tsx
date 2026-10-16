"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { DUEL, duelPendingRound, hoursLeft } from "@trivia/game-core";
import { buttonClassName } from "@/components/button";
import { Mascot } from "@/components/mascot";
import { QuestionCard } from "@/components/question-card";
import { Wheel } from "@/components/wheel";
import { AnswerFeedback, REVEAL_MS } from "@/features/game/answer-feedback";
import { useQuestionTimer } from "@/features/game/use-question-timer";
import {
  NOTIFICATION_EVENT,
  type NotificationRow,
} from "@/features/notifications/notification-toasts";
import { Avatar } from "@/features/profile/avatar";
import { createClient } from "@/lib/supabase/client";
import { startDuel } from "./start-duel";
import type { Duel, DuelAnswerResult, DuelQuestion } from "./types";

// Pausa para ver la categoría que ha salido antes de la primera pregunta.
const AFTER_SPIN_MS = 900;

type Phase = "loading" | "overview" | "spinning" | "question" | "reveal" | "error";
type ErrorKey = "notFound" | "notFriends" | "notEnoughQuestions" | "generic";

/** Conduce el duelo: el servidor decide categoría, preguntas, puntos y turnos; aquí solo se muestra. */
export function DuelGame({ duelId }: { duelId: string }) {
  const t = useTranslations("Duel");
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
    const started = await startDuel(supabase, duel.opponent.id, duel.difficulty);
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

  const timeLeftMs = useQuestionTimer(question, phase === "question", () => void answer(null));

  const afterReveal = useEffectEvent(async () => {
    const loaded = await loadDuel();
    if (!loaded) return;
    if (loaded.nextAction === "answer") await serve();
    else setPhase("overview");
  });
  useEffect(() => {
    if (phase !== "reveal") return;
    const id = setTimeout(() => void afterReveal(), REVEAL_MS);
    return () => clearTimeout(id);
  }, [phase]);

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
          {t("roundOf", { round: duel.turnNumber, total: DUEL.rounds })}
        </p>
        <Wheel
          segments={duel.categories.map((c) => ({ id: c.id, label: c.name, color: c.color }))}
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
            {t("roundOf", { round: question.round, total: DUEL.rounds })}
          </span>
          <span className="flex items-center gap-2 font-display font-bold">
            {t("you")} {duel.me.score} · {duel.opponent.score}
            <Avatar id={duel.opponent.avatarId} size={32} />
          </span>
        </div>
        <QuestionCard
          category={{ label: question.category.name, color: question.category.color }}
          question={question.prompt}
          answers={question.answers.map((text, i) => ({ id: String(i), text }))}
          timeLeft={timeLeftMs / question.timeLimitMs}
          selectedId={chosen === undefined ? undefined : String(chosen)}
          correctId={result ? String(result.correctIndex) : undefined}
          onAnswer={(id) => void answer(Number(id))}
          timerLabel={t("roundOf", { round: question.round, total: DUEL.rounds })}
        />
        <AnswerFeedback result={result} timedOut={chosen === undefined} />
      </main>
    );
  }

  // Resumen del duelo.
  const active = duel.status === "active";
  const rounds = Array.from({ length: DUEL.rounds }, (_, i) =>
    duel.rounds.find((r) => r.round === i + 1),
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4 sm:p-6">
      <DuelHeader
        canSurrender={active}
        busy={busy}
        onSurrender={() => void runAction("surrender_duel")}
      />

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-card bg-surface p-4 sticker">
        <PlayerScore name={t("you")} avatarId={duel.me.avatarId} score={duel.me.score} />
        <span className="font-display text-2xl" aria-hidden="true">
          ⚔
        </span>
        <PlayerScore
          name={duel.opponent.username}
          avatarId={duel.opponent.avatarId}
          score={duel.opponent.score}
        />
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
                  className="size-3.5 shrink-0 rounded-full border-2 border-sticker"
                  style={{ backgroundColor: round.category.color }}
                  aria-hidden="true"
                />
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
          {t(`errors.${actionError}`)}
        </p>
      )}

      <div className="flex flex-col items-center gap-3">
        {duel.nextAction === "spin" && (
          <button type="button" onClick={() => void spin()} className={buttonClassName("play")}>
            {t("spin")}
          </button>
        )}
        {duel.nextAction === "answer" && (
          <button type="button" onClick={() => void serve()} className={buttonClassName("play")}>
            {t("play", { round: duelPendingRound(duel.turnNumber, duel.rounds.length) })}
          </button>
        )}
        {duel.nextAction === "wait" && (
          <p className="text-center font-bold text-fg-muted">
            {t("waiting", {
              name: duel.opponent.username,
              hours: hoursLeft(new Date(duel.deadline), new Date(loadedAt)),
            })}
          </p>
        )}
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
          </>
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

function PlayerScore({ name, avatarId, score }: { name: string; avatarId: string; score: number }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <Avatar id={avatarId} size={56} />
      <span className="max-w-full truncate font-bold">{name}</span>
      <span className="font-display text-2xl font-bold tabular-nums">{score}</span>
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
      <Link href="/" className={buttonClassName("secondary", "px-4 py-2 text-base")}>
        ← {t("back")}
      </Link>
      {canSurrender && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm font-bold text-fg-muted underline"
        >
          {t("surrender")}
        </button>
      )}
    </div>
  );
}

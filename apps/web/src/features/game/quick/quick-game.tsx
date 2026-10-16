"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { phaseAfterReveal, roundOf, seatOf } from "@trivia/game-core";
import { buttonClassName } from "@/components/button";
import { Mascot } from "@/components/mascot";
import { QuestionCard } from "@/components/question-card";
import { AnswerFeedback, REVEAL_MS } from "@/features/game/answer-feedback";
import { useQuestionTimer } from "@/features/game/use-question-timer";
import { Avatar } from "@/features/profile/avatar";
import { createClient } from "@/lib/supabase/client";
import { QuickResults } from "./quick-results";
import type { AnswerResult, QuickMatch, QuickPlayer, ServedQuestion } from "./types";

type Phase = "loading" | "handoff" | "question" | "reveal" | "results" | "error";

/** Conduce la partida: el servidor sirve, cronometra y puntúa; aquí solo se muestra y se envía la elección. */
export function QuickGame({ matchId }: { matchId: string }) {
  const t = useTranslations("Quick");
  const [supabase] = useState(createClient);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<"notFound" | "generic">("generic");
  const [match, setMatch] = useState<QuickMatch | null>(null);
  const [question, setQuestion] = useState<ServedQuestion | null>(null);
  const [chosen, setChosen] = useState<number>();
  const [result, setResult] = useState<AnswerResult | null>(null);
  // Evita enviar dos respuestas (doble toque, o toque justo cuando se agota el tiempo).
  const answering = useRef(false);

  function fail(key: "notFound" | "generic") {
    setError(key);
    setPhase("error");
  }

  async function loadMatch() {
    const { data, error } = await supabase.rpc("get_quick_match", { match_id: matchId });
    if (error || !data) {
      // Un id con formato inválido llega como error de Postgres: para el jugador es igual que no existir.
      fail(error && error.code !== "22P02" ? "generic" : "notFound");
      return null;
    }
    const loaded = data as unknown as QuickMatch;
    setMatch(loaded);
    return loaded;
  }

  async function serve() {
    const { data, error } = await supabase.rpc("serve_quick_question", { match_id: matchId });
    if (error || !data) return fail("generic");
    const served = data as unknown as ServedQuestion;
    answering.current = false;
    setQuestion(served);
    setChosen(undefined);
    setResult(null);
    setPhase("question");
  }

  async function answer(choice: number | null) {
    if (!question || answering.current) return;
    answering.current = true;
    if (choice !== null) setChosen(choice);
    const { data, error } = await supabase.rpc("answer_quick_question", {
      match_id: matchId,
      question_position: question.position,
      // null = tiempo agotado (los tipos generados no admiten null en argumentos de RPC).
      choice: choice as number,
    });
    if (error || !data) return fail("generic");
    const answered = data as unknown as AnswerResult;
    setResult(answered);
    setMatch(
      (m) =>
        m && {
          ...m,
          nextPosition: answered.finished ? null : question.position + 1,
          players: m.players.map((p) =>
            p.seat === question.seat
              ? {
                  ...p,
                  score: p.score + answered.points,
                  correct: p.correct + Number(answered.isCorrect),
                }
              : p,
          ),
        },
    );
    setPhase("reveal");
  }

  // Arranque o reanudación (p. ej. tras recargar): el servidor sabe por dónde va la partida.
  const start = useEffectEvent(async () => {
    const loaded = await loadMatch();
    if (!loaded) return;
    if (loaded.nextPosition === null) setPhase("results");
    else if (loaded.players.length > 1) setPhase("handoff");
    else await serve();
  });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el estado cambia tras la respuesta de red, no en el mismo render
    void start();
  }, []);

  const timeLeftMs = useQuestionTimer(question, phase === "question", () => void answer(null));

  const afterReveal = useEffectEvent(async () => {
    if (!match || !result) return;
    const next = phaseAfterReveal(result.finished, match.players.length);
    if (next === "results") {
      // Puntuaciones definitivas desde el servidor.
      if (await loadMatch()) setPhase("results");
    } else if (next === "handoff") setPhase("handoff");
    else await serve();
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
        <div className="flex gap-3">
          {error === "generic" && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={buttonClassName("primary")}
            >
              {t("retry")}
            </button>
          )}
          <Link href="/" className={buttonClassName("secondary")}>
            {t("home")}
          </Link>
        </div>
      </Centered>
    );
  }

  if (phase === "loading" || !match) {
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

  if (phase === "results") return <QuickResults match={match} />;

  const playerCount = match.players.length;
  const perPlayer = match.total / playerCount;

  if (phase === "handoff" && match.nextPosition !== null) {
    const player = match.players[seatOf(match.nextPosition, playerCount)]!;
    return (
      <Centered>
        <GameHeader>
          <span className="font-bold text-fg-muted">
            {t("round", { round: roundOf(match.nextPosition, playerCount), total: perPlayer })}
          </span>
        </GameHeader>
        <p className="text-lg font-bold text-fg-muted">{t("handoff")}</p>
        <motion.div
          key={player.seat}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-2"
        >
          <Avatar id={player.avatarId} size={120} className="rounded-full sticker" />
          <h1 className="text-4xl font-bold">{player.name}</h1>
        </motion.div>
        <Scoreboard players={match.players} current={player.seat} />
        <button type="button" onClick={() => void serve()} className={buttonClassName("play")}>
          {t("ready")}
        </button>
      </Centered>
    );
  }

  if (!question) return null;
  const player = match.players[question.seat]!;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4 sm:p-6">
      <GameHeader>
        <span className="font-bold text-fg-muted">
          {t("round", { round: roundOf(question.position, playerCount), total: perPlayer })}
        </span>
        {playerCount > 1 && (
          <span className="flex items-center gap-2 font-display font-bold">
            <Avatar id={player.avatarId} size={32} />
            {player.name}
          </span>
        )}
      </GameHeader>

      <QuestionCard
        category={{ label: question.category.name, color: question.category.color }}
        question={question.prompt}
        answers={question.answers.map((text, i) => ({ id: String(i), text }))}
        timeLeft={timeLeftMs / question.timeLimitMs}
        selectedId={chosen === undefined ? undefined : String(chosen)}
        correctId={result ? String(result.correctIndex) : undefined}
        onAnswer={(id) => void answer(Number(id))}
        timerLabel={t("timer")}
      />

      <AnswerFeedback result={result} timedOut={chosen === undefined} />
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

/** Cabecera de la partida con el botón de salir (pide confirmación: salir abandona la partida). */
function GameHeader({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Quick");
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex w-full flex-col gap-3 rounded-card bg-surface p-4 sticker">
        <p className="font-bold">{t("exitConfirm")}</p>
        <div className="flex gap-3">
          <Link href="/" className={buttonClassName("danger")}>
            {t("exit")}
          </Link>
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
    <div className="flex w-full items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={t("exit")}
        className="grid size-10 place-items-center rounded-full bg-surface-2 text-lg font-bold sticker"
      >
        ✕
      </button>
      <div className="flex items-center gap-4">{children}</div>
    </div>
  );
}

function Scoreboard({ players, current }: { players: QuickPlayer[]; current: number }) {
  const t = useTranslations("Quick");
  return (
    <ul className="grid w-full gap-2">
      {players.map((p) => (
        <li
          key={p.seat}
          className={`flex items-center gap-3 rounded-2xl p-1.5 pr-4 sticker ${
            p.seat === current ? "bg-surface-2 ring-4 ring-accent" : "bg-surface"
          }`}
        >
          <Avatar id={p.avatarId} size={36} />
          <span className="font-bold">{p.name}</span>
          <span className="ml-auto font-display font-bold">{t("score", { points: p.score })}</span>
        </li>
      ))}
    </ul>
  );
}

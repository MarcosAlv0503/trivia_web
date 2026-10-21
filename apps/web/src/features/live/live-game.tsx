"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { headToHeadOutcome, LIVE } from "@trivia/game-core";
import { AnalogClock } from "@/components/analog-clock";
import { buttonClassName } from "@/components/button";
import { CloseIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { QuestionCard } from "@/components/question-card";
import { AnswerFeedback } from "@/features/game/answer-feedback";
import { MatchOutcome, useOutcomeOnce } from "@/features/game/match-outcome";
import { playSound } from "@/features/game/sfx";
import { useQuestionTimer } from "@/features/game/use-question-timer";
import { Avatar } from "@/features/profile/avatar";
import { createClient } from "@/lib/supabase/client";
import type { LiveAnswerResult, LiveDuel, LivePlayer, LiveQuestion } from "./types";

type Phase =
  | "loading"
  | "error"
  | "invite"
  | "closed"
  | "countdown"
  | "question"
  | "reveal"
  | "waiting"
  | "results";

type ErrorKey = "notFound" | "generic";

// En las pantallas de espera se pregunta al servidor (además de Realtime): también cierra la partida al acabar.
const POLL_MS = 1500;
const TICK_MS = 100;

/** Reloj de partida congelado (destello, esperas) o en marcha desde `at` (performance.now()). */
type Clock = { ms: number; at: number; running: boolean };

const clockLeft = (clock: Clock, now: number) =>
  clock.running ? Math.max(0, clock.ms - (now - clock.at)) : clock.ms;

/** Conduce el duelo relámpago: el servidor sirve, cronometra y puntúa; aquí solo se muestra y se envía la elección. */
export function LiveGame({ duelId }: { duelId: string }) {
  const t = useTranslations("Live");
  const tQuick = useTranslations("Quick");
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<ErrorKey>("generic");
  const [duel, setDuel] = useState<LiveDuel | null>(null);
  const [question, setQuestion] = useState<LiveQuestion | null>(null);
  const [chosen, setChosen] = useState<number>();
  const [result, setResult] = useState<LiveAnswerResult | null>(null);
  const [scores, setScores] = useState({ me: 0, rival: 0 });
  const [clock, setClock] = useState<Clock>({ ms: LIVE.matchMs, at: 0, running: false });
  // Fin de la cuenta atrás o de la invitación, en performance.now().
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  // Evita enviar dos respuestas (doble toque, o toque justo cuando se agota el tiempo) y pedir dos veces la
  // siguiente (fin de la cuenta atrás en varios tics seguidos).
  const answering = useRef(false);
  const serving = useRef(false);

  function fail(key: ErrorKey) {
    setError(key);
    setPhase("error");
  }

  async function load() {
    const { data, error } = await supabase.rpc("get_live_duel", { duel_id: duelId });
    if (error || !data) {
      // Id con formato inválido (22P02) o inexistente (P0002): para el jugador es lo mismo.
      fail(error && error.code !== "22P02" && error.code !== "P0002" ? "generic" : "notFound");
      return null;
    }
    const loaded = data as unknown as LiveDuel;
    setDuel(loaded);
    setScores({ me: loaded.me.score, rival: loaded.opponent.score });
    return loaded;
  }

  /** Pasa a la pantalla que toca según el estado del servidor (al cargar, al recargar o al cambiar). */
  async function route(loaded: LiveDuel) {
    const at = performance.now();
    setNow(at);
    switch (loaded.status) {
      case "pending":
        setDeadline(at + (loaded.inviteLeftMs ?? 0));
        return setPhase("invite");
      case "active":
        if ((loaded.startsInMs ?? 0) > 0) {
          setDeadline(at + loaded.startsInMs!);
          return setPhase("countdown");
        }
        if (loaded.done) return enterWaiting();
        return serve();
      case "finished":
        return setPhase("results");
      default:
        return setPhase("closed");
    }
  }

  async function refresh() {
    const loaded = await load();
    if (loaded) await route(loaded);
  }

  function enterWaiting() {
    setClock({ ms: 0, at: 0, running: false });
    setQuestion(null);
    setPhase("waiting");
  }

  async function serve() {
    if (serving.current) return;
    serving.current = true;
    const { data, error } = await supabase.rpc("serve_live_question", { duel_id: duelId });
    serving.current = false;
    if (error || !data) {
      // El móvil puede ir un pelín adelantado respecto al servidor: se reintenta enseguida.
      if (error?.hint === "live_not_started") return void setTimeout(() => void serve(), 300);
      if (error?.hint === "live_time_up" || error?.hint === "live_not_active") return refresh();
      return fail("generic");
    }
    const served = data as unknown as LiveQuestion;
    answering.current = false;
    setQuestion(served);
    setChosen(undefined);
    setResult(null);
    setClock({ ms: served.remainingMs, at: performance.now(), running: true });
    setPhase("question");
  }

  async function answer(choice: number | null) {
    if (!question || answering.current) return;
    answering.current = true;
    if (choice !== null) setChosen(choice);
    // El reloj se para al elegir y no corre durante el destello.
    setClock({ ms: clockLeft(clock, performance.now()), at: 0, running: false });
    const { data, error } = await supabase.rpc("answer_live_question", {
      duel_id: duelId,
      question_position: question.position,
      // null = tiempo agotado (los tipos generados no admiten null en argumentos de RPC).
      choice: choice as number,
    });
    if (error || !data) {
      if (error?.hint === "live_not_active" || error?.hint === "question_unavailable")
        return refresh();
      return fail("generic");
    }
    const answered = data as unknown as LiveAnswerResult;
    setResult(answered);
    setScores((s) => ({ ...s, me: s.me + answered.points }));
    setPhase("reveal");
  }

  async function respondInvite(accept: boolean) {
    setBusy(true);
    await supabase.rpc("answer_live_invite", { duel_id: duelId, accept });
    // Aceptada, rechazada o ya no disponible: el servidor dice qué pantalla toca.
    await refresh();
    setBusy(false);
  }

  async function cancelInvite() {
    setBusy(true);
    await supabase.rpc("cancel_live_duel", { duel_id: duelId });
    router.push("/live");
  }

  // Arranque o reanudación (p. ej. tras recargar): el servidor sabe por dónde va la partida.
  const start = useEffectEvent(() => refresh());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el estado cambia tras la respuesta de red, no en el mismo render
    void start();
  }, []);

  // Marcador del rival y cambios de estado en vivo. Solo llegan las filas de las partidas propias (RLS).
  const onChange = useEffectEvent(
    (row: { status: string; challenger_score: number; opponent_score: number }) => {
      if (!duel) return;
      setScores((s) => ({
        ...s,
        rival: duel.isChallenger ? row.opponent_score : row.challenger_score,
      }));
      if ((phase === "invite" || phase === "waiting") && row.status !== duel.status) void refresh();
    },
  );
  useEffect(() => {
    const channel = supabase
      .channel(`live:${duelId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_duels", filter: `id=eq.${duelId}` },
        (payload) => onChange(payload.new as Parameters<typeof onChange>[0]),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, duelId]);

  const poll = useEffectEvent(() => refresh());
  useEffect(() => {
    if (phase !== "invite" && phase !== "waiting") return;
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [phase]);

  // Reloj de pantalla: cuentas atrás y reloj de partida (con tic-tac en los últimos segundos).
  const lastSecond = useRef(Infinity);
  const onTick = useEffectEvent(() => {
    const at = performance.now();
    setNow(at);
    if (phase === "countdown" && at >= deadline) return void serve();
    const second = Math.ceil((phase === "countdown" ? deadline - at : clockLeft(clock, at)) / 1000);
    const ticking = phase === "countdown" || (clock.running && second * 1000 <= LIVE.warningMs);
    if (ticking && second >= 1 && second < lastSecond.current) playSound("tick");
    lastSecond.current = second;
  });
  useEffect(() => {
    if (phase !== "invite" && phase !== "countdown" && phase !== "question") return;
    lastSecond.current = Infinity;
    const id = setInterval(onTick, TICK_MS);
    return () => clearInterval(id);
  }, [phase]);

  // Tras el destello, la siguiente (o a esperar al rival si se acabó tu tiempo).
  const advance = useEffectEvent(() => (result?.done ? enterWaiting() : void serve()));
  useEffect(() => {
    if (phase !== "reveal") return;
    const id = setTimeout(advance, LIVE.revealMs);
    return () => clearTimeout(id);
  }, [phase]);

  // La pregunta dura 6 s o lo que le quede a tu reloj, lo que acabe antes (el servidor aplica lo mismo).
  const timed = useMemo(
    () =>
      question && {
        timeLimitMs: question.timeLimitMs,
        elapsedMs: Math.max(question.elapsedMs, question.timeLimitMs - question.remainingMs),
      },
    [question],
  );
  const questionLeftMs = useQuestionTimer(
    timed,
    phase === "question" && chosen === undefined,
    () => void answer(null),
    { ticks: false },
  );

  const finished = phase === "results" && duel?.result ? duel.result : null;
  const outcome = useOutcomeOnce(finished ? `live:${duelId}` : null);

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

  const rival = duel.opponent;

  if (phase === "invite") {
    const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
    return (
      <Centered>
        <Avatar id={rival.avatarId} size={110} className="rounded-full sticker" />
        {duel.isChallenger ? (
          <>
            <h1 className="text-center text-3xl font-bold">
              {t("waitingInvite", { name: rival.username })}
            </h1>
            <p className="font-display text-5xl font-bold tabular-nums" aria-live="off">
              {seconds}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void cancelInvite()}
              className={buttonClassName("secondary")}
            >
              {t("cancel")}
            </button>
          </>
        ) : (
          <>
            <h1 className="text-center text-3xl font-bold">
              {t("invited", { name: rival.username })}
            </h1>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void respondInvite(true)}
                className={buttonClassName("play")}
              >
                {t("accept")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void respondInvite(false)}
                className={buttonClassName("secondary")}
              >
                {t("decline")}
              </button>
            </div>
          </>
        )}
      </Centered>
    );
  }

  if (phase === "closed") {
    return (
      <Centered>
        <Mascot size={110} variant="bored" />
        <p role="alert" className="text-center text-lg font-bold">
          {t(`closed.${duel.status as "declined" | "expired" | "cancelled"}`, {
            name: rival.username,
          })}
        </p>
        <div className="flex gap-3">
          <Link href="/live" className={buttonClassName("play")}>
            {t("challengeAnother")}
          </Link>
          <Link href="/" className={buttonClassName("secondary")}>
            {t("home")}
          </Link>
        </div>
      </Centered>
    );
  }

  if (phase === "countdown") {
    const seconds = Math.max(1, Math.ceil((deadline - now) / 1000));
    return (
      <Centered>
        <Scoreboard me={duel.me} rival={rival} scores={scores} label={t("you")} />
        <p className="text-lg font-bold text-fg-muted">{t("getReady")}</p>
        <motion.p
          key={seconds}
          initial={{ scale: 1.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="font-display text-8xl font-bold text-play"
        >
          {seconds}
        </motion.p>
      </Centered>
    );
  }

  if (phase === "results") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 sm:p-6">
        {finished && outcome.showing && (
          <MatchOutcome
            kind={headToHeadOutcome(finished, duel.me.score, LIVE.legendaryDraw)}
            onDone={outcome.dismiss}
          />
        )}
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <h1 className="text-center text-4xl font-bold">{finished && t(`results.${finished}`)}</h1>
          <div className="grid w-full grid-cols-2 gap-3">
            {[duel.me, rival].map((player, i) => (
              <div
                key={player.id}
                className="flex flex-col items-center gap-1 rounded-card bg-surface p-4 sticker"
              >
                <Avatar id={player.avatarId} size={64} />
                <span className="max-w-full truncate font-bold">
                  {i === 0 ? t("you") : player.username}
                </span>
                <span className="font-display text-3xl font-bold">
                  {tQuick("score", { points: player.score })}
                </span>
                <span className="text-sm text-fg-muted">
                  {t("correctCount", { correct: player.correct, answered: player.answered })}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex w-full gap-3">
          <Link href="/live" className={buttonClassName("play", "flex-1")}>
            {t("challengeAnother")}
          </Link>
          <Link href="/" className={buttonClassName("secondary", "py-3.5")}>
            {t("home")}
          </Link>
        </div>
      </main>
    );
  }

  const left = clockLeft(clock, now);
  const clockView = (
    <AnalogClock
      remainingMs={left}
      totalMs={LIVE.matchMs}
      questionLeft={
        phase === "question" && question && chosen === undefined
          ? questionLeftMs / question.timeLimitMs
          : null
      }
      warning={left <= LIVE.warningMs}
      label={t("clockLabel", { seconds: Math.ceil(left / 1000) })}
    />
  );

  if (phase === "waiting") {
    return (
      <Centered>
        <Scoreboard me={duel.me} rival={rival} scores={scores} label={t("you")}>
          {clockView}
        </Scoreboard>
        <p className="font-display text-3xl font-bold text-ko">{t("timeUp")}</p>
        <motion.p
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="text-center text-lg font-bold text-fg-muted"
        >
          {t("waitingRival", { name: rival.username })}
        </motion.p>
      </Centered>
    );
  }

  if (!question) return null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4 sm:p-6">
      <ExitButton />
      <Scoreboard me={duel.me} rival={rival} scores={scores} label={t("you")}>
        {clockView}
      </Scoreboard>
      <QuestionCard
        category={{
          id: question.category.id,
          label: question.category.name,
          color: question.category.color,
        }}
        badge={question.topical ? tQuick("topical") : undefined}
        question={question.prompt}
        answers={question.answers.map((text, i) => ({ id: String(i), text }))}
        timeLeft={questionLeftMs / question.timeLimitMs}
        timeLimitMs={question.timeLimitMs}
        selectedId={chosen === undefined ? undefined : String(chosen)}
        correctId={result ? String(result.correctIndex) : undefined}
        onAnswer={(id) => void answer(Number(id))}
        timerLabel={tQuick("timer")}
        hideTimer
      />
      {/* shortcut: los 13 puntos caen en el nivel "fast" de speedTier (pensado para 15/12/10); si cambia
          SCORING, dar a AnswerFeedback su propio nivel de rapidez. */}
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

/** Marcador en vivo: tú, el reloj y el rival. */
function Scoreboard({
  me,
  rival,
  scores,
  label,
  children,
}: {
  me: LivePlayer;
  rival: LivePlayer;
  scores: { me: number; rival: number };
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
      <PlayerScore name={label} avatarId={me.avatarId} score={scores.me} />
      {children ?? <span />}
      <PlayerScore name={rival.username} avatarId={rival.avatarId} score={scores.rival} />
    </div>
  );
}

function PlayerScore({ name, avatarId, score }: { name: string; avatarId: string; score: number }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <Avatar id={avatarId} size={48} />
      <span className="max-w-full truncate text-sm font-bold">{name}</span>
      <motion.span
        key={score}
        initial={{ scale: 1.4 }}
        animate={{ scale: 1 }}
        className="font-display text-2xl font-bold tabular-nums"
      >
        {score}
      </motion.span>
    </div>
  );
}

/** Salir a mitad (pide confirmación): el reloj sigue corriendo en el servidor y se deja de sumar. */
function ExitButton() {
  const t = useTranslations("Live");
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
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label={t("exit")}
      className="grid size-10 place-items-center rounded-full bg-surface-2 text-lg font-bold sticker"
    >
      <CloseIcon size={18} />
    </button>
  );
}

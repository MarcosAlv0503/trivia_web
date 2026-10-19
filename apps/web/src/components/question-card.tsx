"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CategoryIcon } from "./category-icon";

export type Answer = { id: string; text: string };

type Props = {
  category: { id: string; label: string; color: string };
  /** Distintivo junto a la categoría (p. ej. "Actualidad"), ya traducido. */
  badge?: string;
  question: string;
  answers: Answer[];
  /** Fracción de tiempo restante (0–1). */
  timeLeft: number;
  /** Tiempo total de la pregunta: la barra se vacía sola, de forma continua, durante lo que queda. */
  timeLimitMs: number;
  /** Respuesta elegida por el jugador, si ya ha contestado. */
  selectedId?: string;
  /** Respuesta correcta: solo se conoce cuando el servidor la revela tras contestar. */
  correctId?: string;
  onAnswer: (id: string) => void;
  /** Texto accesible de la barra de tiempo (traducido por quien usa el componente). */
  timerLabel: string;
};

// Componente de presentación: no decide nada del juego, solo muestra el estado que recibe.
export function QuestionCard({
  category,
  badge,
  question,
  answers,
  timeLeft,
  timeLimitMs,
  selectedId,
  correctId,
  onAnswer,
  timerLabel,
}: Props) {
  const reduceMotion = useReducedMotion();
  // Bloqueada al elegir o al revelar la correcta (también si se agotó el tiempo sin elegir).
  const answered = selectedId !== undefined || correctId !== undefined;

  // Teclado: 1, 2, 3… responden la respuesta en esa posición.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const answer = answers[Number(e.key) - 1];
    if (answer) onAnswer(answer.id);
  });
  useEffect(() => {
    if (answered) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answered]);

  return (
    <div className="grid gap-4 rounded-card bg-surface p-5 sticker">
      <div className="flex flex-wrap gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-sticker px-3 py-0.5 text-sm font-extrabold text-ink"
          style={{ backgroundColor: category.color }}
        >
          <CategoryIcon id={category.id} size={16} />
          {category.label}
        </span>
        {badge && (
          <span className="rounded-full border-2 border-sticker bg-accent px-3 py-0.5 text-sm font-extrabold text-accent-ink">
            {badge}
          </span>
        )}
      </div>

      <div
        role="progressbar"
        aria-label={timerLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(timeLeft * 100)}
        className="h-3 overflow-hidden rounded-full border-2 border-sticker bg-bg-deep"
      >
        {/* key: cada pregunta nueva empieza su propia animación desde lo que le queda. */}
        <TimerFill key={question} start={timeLeft} timeLimitMs={timeLimitMs} frozen={answered} />
      </div>

      <p className="font-display text-xl font-bold">{question}</p>

      <div className="grid gap-2.5">
        {answers.map((answer) => {
          const isCorrect = answer.id === correctId;
          const isWrongPick = answer.id === selectedId && correctId !== undefined && !isCorrect;
          return (
            <motion.button
              key={answer.id}
              type="button"
              disabled={answered}
              onClick={() => onAnswer(answer.id)}
              animate={isWrongPick && !reduceMotion ? { x: [0, -6, 6, -4, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
              className={`rounded-2xl px-4 py-3 text-left font-bold sticker ${
                isCorrect ? "bg-ok text-ink" : isWrongPick ? "bg-ko text-white" : "bg-surface-2"
              } ${answer.id === selectedId && correctId === undefined ? "ring-4 ring-accent" : ""}`}
            >
              {answer.text}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Relleno de la barra de tiempo: una animación CSS continua desde lo que quedaba al montarse hasta 0, sincronizada
 * con el reloj real (sin saltos ni retraso); al responder se pausa y queda congelada.
 */
function TimerFill({
  start,
  timeLimitMs,
  frozen,
}: {
  start: number;
  timeLimitMs: number;
  frozen: boolean;
}) {
  const [from] = useState(() => Math.max(0, Math.min(1, start)));
  return (
    <div
      className="h-full bg-linear-to-r from-play to-ko"
      style={{
        width: `${from * 100}%`,
        animation: `timer-drain ${from * timeLimitMs}ms linear forwards`,
        animationPlayState: frozen ? "paused" : "running",
      }}
    />
  );
}

"use client";

import { motion, useReducedMotion } from "motion/react";

export type Answer = { id: string; text: string };

type Props = {
  category: { label: string; color: string };
  question: string;
  answers: Answer[];
  /** Fracción de tiempo restante (0–1). */
  timeLeft: number;
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
  question,
  answers,
  timeLeft,
  selectedId,
  correctId,
  onAnswer,
  timerLabel,
}: Props) {
  const reduceMotion = useReducedMotion();
  const answered = selectedId !== undefined;

  return (
    <div className="grid gap-4 rounded-card bg-surface p-5 sticker">
      <span
        className="justify-self-start rounded-full border-2 border-sticker px-3 py-0.5 text-sm font-extrabold text-ink"
        style={{ backgroundColor: category.color }}
      >
        {category.label}
      </span>

      <div
        role="progressbar"
        aria-label={timerLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(timeLeft * 100)}
        className="h-3 overflow-hidden rounded-full border-2 border-sticker bg-bg-deep"
      >
        <div
          className="h-full bg-linear-to-r from-play to-ko transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.max(0, Math.min(1, timeLeft)) * 100}%` }}
        />
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

"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { playSound } from "./sfx";

const TICK_MS = 250;

type TimedQuestion = { timeLimitMs: number; elapsedMs: number };

/**
 * Cuenta atrás de la pregunta servida (el servidor ya descuenta lo transcurrido, p. ej. tras recargar).
 * Mientras `running`, llama a `onExpire` en cada tic a partir de 0: quien la usa debe ignorar llamadas repetidas.
 */
export function useQuestionTimer(
  question: TimedQuestion | null,
  running: boolean,
  onExpire: () => void,
) {
  const [tick, setTick] = useState<{ question: TimedQuestion | null; left: number }>({
    question: null,
    left: 0,
  });
  const expire = useEffectEvent(onExpire);

  useEffect(() => {
    if (!running || !question) return;
    const deadline = performance.now() + question.timeLimitMs - question.elapsedMs;
    let lastSecond = Infinity;
    const id = setInterval(() => {
      const left = deadline - performance.now();
      setTick({ question, left: Math.max(0, left) });
      // Un "tic" en cada uno de los últimos 3 segundos.
      const second = Math.ceil(left / 1000);
      if (second >= 1 && second <= 3 && second < lastSecond) playSound("tick");
      lastSecond = Math.min(lastSecond, second);
      if (left <= 0) expire();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running, question]);

  if (!question) return 0;
  return tick.question === question ? tick.left : question.timeLimitMs - question.elapsedMs;
}

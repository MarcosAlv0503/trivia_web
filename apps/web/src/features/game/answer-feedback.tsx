"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";

/** Tiempo que se muestra la respuesta correcta antes de avanzar solo. */
export const REVEAL_MS = 2000;

type Props = {
  result: { isCorrect: boolean; points: number } | null;
  /** Se agotó el tiempo sin elegir respuesta. */
  timedOut: boolean;
};

/** Mensaje tras responder: acierto con puntos, fallo o tiempo agotado. */
export function AnswerFeedback({ result, timedOut }: Props) {
  const t = useTranslations("Quick");
  return (
    <div aria-live="polite" className="min-h-10 text-center">
      {result && (
        <motion.p
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`font-display text-2xl font-bold ${result.isCorrect ? "text-ok" : "text-ko"}`}
        >
          {result.isCorrect
            ? `${t("correct")} ${t("points", { points: result.points })}`
            : timedOut
              ? t("timeUp")
              : t("wrong")}
        </motion.p>
      )}
    </div>
  );
}

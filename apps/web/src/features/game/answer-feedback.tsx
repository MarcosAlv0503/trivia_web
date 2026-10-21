"use client";

import { useEffectEvent, useLayoutEffect } from "react";
import { motion, useReducedMotion, type TargetAndTransition } from "motion/react";
import { useTranslations } from "next-intl";
import { speedTier } from "@trivia/game-core";
import { playSound, vibrate } from "./sfx";
import { QuickIcon, SparkleIcon, StarIcon } from "@/components/icons";

type Props = {
  /** `hitRate`: % de jugadores que aciertan la pregunta (null u omitido = no se muestra). */
  result: { isCorrect: boolean; points: number; hitRate?: number | null } | null;
  /** Se agotó el tiempo sin elegir respuesta. */
  timedOut: boolean;
};

type Tier = "normal" | "fast" | "veryFast";

// El texto es siempre "¡Correcto! +X"; la rapidez se distingue por el estilo y la entrada.
const BADGE: Record<Tier, { className: string; enter: TargetAndTransition }> = {
  normal: {
    className: "bg-ok text-ink text-2xl",
    enter: {
      scale: [0.5, 1.08, 1],
      opacity: 1,
      transition: { duration: 0.35 },
    },
  },
  fast: {
    className: "bg-play text-ink text-2xl",
    enter: {
      scale: [0.3, 1.18, 1],
      rotate: [-10, 5, 0],
      opacity: 1,
      transition: { duration: 0.45 },
    },
  },
  veryFast: {
    className: "bg-accent text-accent-ink text-3xl",
    enter: {
      scale: [0.2, 1.35, 1],
      x: [0, -7, 7, -5, 5, 0],
      rotate: [0, -7, 7, -3, 0],
      opacity: 1,
      transition: { duration: 0.6 },
    },
  },
};

/** Mensaje tras responder: acierto (con animación según la rapidez), fallo o tiempo agotado. */
export function AnswerFeedback({ result, timedOut }: Props) {
  const t = useTranslations("Quick");
  const reduceMotion = useReducedMotion();
  const tier = result?.isCorrect ? speedTier(result.points) : null;

  const announce = useEffectEvent(() => {
    if (tier) return playSound(tier === "normal" ? "correct" : tier);
    playSound(timedOut ? "timeout" : "wrong");
    vibrate([60, 40, 60]);
  });
  // Antes de pintar: el sonido sale a la vez que se ve el resultado.
  useLayoutEffect(() => {
    if (result) announce();
  }, [result]);

  return (
    <div aria-live="polite" className="relative grid min-h-16 place-items-center">
      {result && !tier && (
        // Misma pegatina que el acierto: cae, rebota y se asienta como un sello (sin desvanecerse).
        <motion.p
          className="relative z-20 rounded-full bg-ko px-5 py-1.5 font-display text-2xl font-bold text-white sticker"
          initial={{ opacity: 0, y: reduceMotion ? 0 : -28, scale: reduceMotion ? 1 : 0.7 }}
          animate={
            reduceMotion
              ? { opacity: 1 }
              : {
                  opacity: [0, 1, 1, 1],
                  y: [-28, 4, 0, 0],
                  scale: [0.7, 1.08, 0.95, 1],
                  rotate: [0, -3, 2, 0],
                  transition: { duration: 0.45, times: [0, 0.35, 0.65, 1], ease: "easeOut" },
                }
          }
        >
          {timedOut ? t("timeUp") : t("wrong")}
        </motion.p>
      )}

      {tier && (
        <>
          {!reduceMotion && tier === "veryFast" && (
            // Destello de color en toda la pantalla.
            <motion.div
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 z-10 bg-accent"
              initial={{ opacity: 0.35 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          )}
          {!reduceMotion && tier === "fast" && (
            <Burst count={8} distance={70} shapes={[SparkleIcon]} colors={["var(--color-play)"]} />
          )}
          {!reduceMotion && tier === "veryFast" && (
            <Burst
              count={14}
              distance={120}
              shapes={[StarIcon, SparkleIcon]}
              colors={["var(--color-accent)", "var(--color-play)", "var(--color-ok)"]}
            />
          )}
          <motion.p
            className={`relative z-20 inline-flex items-center gap-2 rounded-full px-5 py-1.5 font-display font-bold sticker ${BADGE[tier].className}`}
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.5 }}
            animate={reduceMotion ? { opacity: 1 } : BADGE[tier].enter}
          >
            {tier !== "normal" && (
              <motion.span
                className="flex"
                aria-hidden="true"
                animate={reduceMotion ? undefined : { rotate: [0, -15, 15, 0] }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <QuickIcon size={26} />
                {tier === "veryFast" && <QuickIcon size={26} className="-ml-2.5" />}
              </motion.span>
            )}
            {t("correct")} {t("points", { points: result!.points })}
          </motion.p>
        </>
      )}

      {result?.hitRate != null && (
        <p className="relative z-20 mt-2 text-sm font-bold text-fg-muted">
          {t("hitRate", { rate: result.hitRate })}
        </p>
      )}
    </div>
  );
}

/** Partículas que salen disparadas en círculo desde el centro de la insignia. */
function Burst({
  count,
  distance,
  shapes,
  colors,
}: {
  count: number;
  distance: number;
  shapes: ((props: { size?: number }) => React.ReactNode)[];
  colors: string[];
}) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 2 * Math.PI;
        // Distancias alternas para que el estallido no parezca un círculo perfecto.
        const reach = distance * (i % 2 === 0 ? 1 : 0.7);
        return (
          <motion.span
            key={i}
            className="absolute top-1/2 left-1/2 -mt-2.5 -ml-2.5"
            style={{ color: colors[i % colors.length] }}
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
            animate={{
              x: Math.cos(angle) * reach,
              y: Math.sin(angle) * reach,
              scale: 1.1,
              opacity: 0,
              rotate: 180,
            }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
          >
            {shapes[i % shapes.length]!({ size: 20 })}
          </motion.span>
        );
      })}
    </div>
  );
}

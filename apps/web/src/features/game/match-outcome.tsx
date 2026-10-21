"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import type { OutcomeKind } from "@trivia/game-core";
import { DuelIcon, SparkleIcon } from "@/components/icons";
import { Mascot, type MascotVariant } from "@/components/mascot";
import { playSound } from "./sfx";

// Tiempo en pantalla antes de cerrarse sola (se puede saltar tocando).
const SHOW_MS = 3600;
// Confeti con los colores de categoría.
const CONFETTI_COLORS = [
  "#2ECC8F",
  "#D9964A",
  "#2EC4E6",
  "#9B7BFF",
  "#FF7A45",
  "#F5C431",
  "#5C7CFA",
];

const STYLE: Record<OutcomeKind, { mascot: MascotVariant; title: string }> = {
  victory: { mascot: "party", title: "bg-play text-ink" },
  defeat: { mascot: "tired", title: "bg-surface-2 text-fg" },
  draw: { mascot: "bored", title: "bg-surface-2 text-fg-muted" },
  legendaryDraw: { mascot: "knight", title: "bg-accent text-accent-ink" },
};

/**
 * Animación a pantalla completa del final de una partida con rival, con su sonido. `names`: en local, quién gana o
 * quiénes empatan. Al cerrarse (sola o tocando) llama a `onDone`.
 */
export function MatchOutcome({
  kind,
  names,
  onDone,
}: {
  kind: OutcomeKind;
  names?: string[];
  onDone: () => void;
}) {
  const t = useTranslations("Outcome");
  const locale = useLocale();
  const reduceMotion = useReducedMotion() ?? false;
  const done = useEffectEvent(onDone);

  useEffect(() => {
    playSound(kind);
    const timer = setTimeout(() => done(), SHOW_MS);
    return () => clearTimeout(timer);
  }, [kind]);

  const subtitle = names?.length
    ? new Intl.ListFormat(locale, { type: "conjunction" }).format(names)
    : kind === "defeat"
      ? t("defeatSub")
      : kind === "legendaryDraw"
        ? t("legendarySub")
        : null;

  return (
    <motion.button
      type="button"
      autoFocus
      onClick={onDone}
      aria-label={`${t(kind)}. ${t("skip")}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 overflow-hidden p-6 backdrop-blur-sm ${
        kind === "legendaryDraw"
          ? "bg-[radial-gradient(circle_at_50%_40%,#5a4a1a_0%,var(--color-bg-deep)_65%)]"
          : kind === "victory"
            ? "bg-bg/90"
            : "bg-bg-deep/95"
      }`}
    >
      {!reduceMotion && kind === "victory" && <Confetti />}
      {!reduceMotion && kind === "legendaryDraw" && <Sparkles />}

      <div className="relative grid place-items-center">
        {kind === "legendaryDraw" && (
          <motion.div
            className="absolute"
            initial={reduceMotion ? false : { scale: 0.3, rotate: -90, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 0.9 }}
            transition={{ type: "spring", bounce: 0.4, delay: 0.2 }}
          >
            <DuelIcon size={260} />
          </motion.div>
        )}
        {/* Entrada una vez y, dentro, el movimiento propio de cada final (que puede repetirse). */}
        <motion.div
          className="relative drop-shadow-[0_6px_0_var(--color-sticker)]"
          initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
        >
          <motion.div
            animate={reduceMotion ? undefined : mascotMotion(kind)}
            transition={mascotTransition(kind)}
          >
            <Mascot size={180} variant={STYLE[kind].mascot} />
          </motion.div>
        </motion.div>
      </div>

      <motion.p
        className={`rounded-full px-6 py-2 text-center font-display text-4xl font-bold sticker ${STYLE[kind].title}`}
        initial={reduceMotion ? false : titleFrom(kind)}
        animate={reduceMotion ? { opacity: 1 } : titleTo(kind)}
        transition={titleTransition(kind)}
      >
        {t(kind)}
      </motion.p>
      {subtitle && (
        <motion.p
          className="text-center font-display text-2xl font-bold"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          {subtitle}
        </motion.p>
      )}
      <span className="absolute bottom-8 text-sm font-bold text-fg-muted">{t("skip")}</span>
    </motion.button>
  );
}

function mascotMotion(kind: OutcomeKind) {
  switch (kind) {
    case "victory":
      // Saltos de alegría con meneo.
      return { y: [0, -36, 0, -24, 0], rotate: [0, -8, 8, -5, 0] };
    case "defeat":
      // Respiración agitada, pero sin hundirse.
      return { scale: [1, 1.04, 1, 1.04, 1], y: [0, 3, 0, 3, 0] };
    case "draw":
      return { rotate: [0, -3, 0] };
    case "legendaryDraw":
      return { scale: [1, 1.12, 1], y: [0, -10, 0] };
  }
}

function mascotTransition(kind: OutcomeKind) {
  switch (kind) {
    case "victory":
      return { duration: 1.1, repeat: Infinity, ease: "easeOut" } as const;
    case "defeat":
      return { duration: 1.8, repeat: Infinity, ease: "easeInOut" } as const;
    case "draw":
      return { duration: 2.4, ease: "easeInOut" } as const;
    case "legendaryDraw":
      return { duration: 1.4, delay: 0.3, ease: "easeOut" } as const;
  }
}

function titleFrom(kind: OutcomeKind) {
  return kind === "draw" ? { opacity: 0, y: -60 } : { opacity: 0, scale: 0.3, rotate: -8 };
}

function titleTo(kind: OutcomeKind) {
  switch (kind) {
    case "draw":
      // Cae sin gracia y se queda torcido.
      return { opacity: 1, y: 0, rotate: 2 };
    case "legendaryDraw":
      return { opacity: 1, scale: 1, rotate: [0, -3, 3, -2, 0], x: [0, -6, 6, -4, 0] };
    default:
      return { opacity: 1, scale: 1, rotate: 0 };
  }
}

function titleTransition(kind: OutcomeKind) {
  switch (kind) {
    case "draw":
      return { duration: 0.5, ease: "linear", delay: 0.3 } as const;
    case "legendaryDraw":
      return { duration: 0.7, delay: 1.2 } as const;
    case "defeat":
      return { duration: 0.6, delay: 0.4 } as const;
    default:
      return { type: "spring", bounce: 0.6, delay: 0.2 } as const;
  }
}

function Confetti() {
  // Posiciones al azar una vez por montaje (no en cada render).
  const [pieces] = useState(() =>
    Array.from({ length: 48 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 1.8 + Math.random() * 1.4,
      spin: (Math.random() - 0.5) * 720,
      drift: (Math.random() - 0.5) * 80,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      round: i % 3 === 0,
    })),
  );
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className={`absolute top-0 block border border-sticker ${p.round ? "size-2.5 rounded-full" : "h-3.5 w-2"}`}
          style={{ left: `${p.left}%`, backgroundColor: p.color }}
          initial={{ y: "-5vh", x: 0, rotate: 0 }}
          animate={{ y: "110vh", x: p.drift, rotate: p.spin }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

function Sparkles() {
  const [stars] = useState(() =>
    Array.from({ length: 14 }, () => ({
      left: 5 + Math.random() * 90,
      top: 5 + Math.random() * 80,
      delay: 1.1 + Math.random() * 1.2,
      size: 18 + Math.random() * 22,
    })),
  );
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 text-play">
      {stars.map((s, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ left: `${s.left}%`, top: `${s.top}%` }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.2, 0.8], opacity: [0, 1, 0.7], rotate: [0, 45, 90] }}
          transition={{ duration: 1.2, delay: s.delay, repeat: Infinity, repeatDelay: 0.6 }}
        >
          <SparkleIcon size={s.size} />
        </motion.span>
      ))}
    </div>
  );
}

const SEEN_PREFIX = "trivia:outcome-seen:";

/**
 * Muestra la animación de final una sola vez por partida en este dispositivo: al reabrir una partida terminada solo
 * se ve el resultado. `key` null = aún no hay final. Devuelve si se está mostrando, si ya se puede enseñar lo que va
 * después (la XP) y cómo cerrarla.
 */
export function useOutcomeOnce(key: string | null) {
  const [state, setState] = useState<{ key: string | null; phase: "showing" | "done" }>({
    key: null,
    phase: "done",
  });

  useEffect(() => {
    if (!key) return;
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_PREFIX + key) !== null;
      localStorage.setItem(SEEN_PREFIX + key, "1");
    } catch {
      // Sin almacenamiento (modo privado...): se muestra cada vez, sin más.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el navegador
    setState({ key, phase: seen ? "done" : "showing" });
  }, [key]);

  const checked = key !== null && state.key === key;
  return {
    showing: checked && state.phase === "showing",
    afterOutcome: checked && state.phase === "done",
    dismiss: () => setState({ key, phase: "done" }),
  };
}

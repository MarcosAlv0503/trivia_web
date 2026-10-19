"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CategoryIcon } from "./category-icon";

/** `id` es el de la categoría: decide su icono. */
export type WheelSegment = { id: string; label: string; color: string };

type Props = {
  segments: WheelSegment[];
  /** Índice del segmento en el que debe parar (lo decide quien usa el componente, p. ej. el servidor); `null` = en reposo. */
  target: number | null;
  onSpinEnd?: () => void;
};

const FULL_TURNS = 4;

export function Wheel({ segments, target, onSpinEnd }: Props) {
  const reduceMotion = useReducedMotion();
  const [rotation, setRotation] = useState(0);
  const lastTarget = useRef<number | null>(null);
  const slice = 360 / segments.length;

  useEffect(() => {
    // Para girar dos veces seguidas al mismo segmento, pasa `null` entre giros.
    if (target === null || target === lastTarget.current) {
      if (target === null) lastTarget.current = null;
      return;
    }
    lastTarget.current = target;
    // Gira varias vueltas y deja el centro del segmento bajo el puntero (arriba).
    setRotation((current) => {
      const stopAt = 360 - (target * slice + slice / 2);
      return current - (current % 360) + 360 * FULL_TURNS + stopAt;
    });
  }, [target, slice]);

  const gradient = segments
    .map((s, i) => `${s.color} ${i * slice}deg ${(i + 1) * slice}deg`)
    .join(", ");

  return (
    <div className="relative aspect-square w-full max-w-80">
      <div
        aria-hidden="true"
        className="absolute -top-3.5 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-16 border-t-28 border-x-transparent border-t-accent drop-shadow-[0_3px_0_var(--color-sticker)]"
      />
      <motion.div
        aria-hidden="true"
        className="relative h-full w-full rounded-full border-[5px] border-sticker shadow-[0_6px_0_var(--color-sticker)]"
        style={{ background: `conic-gradient(${gradient})` }}
        animate={{ rotate: rotation }}
        transition={{ duration: reduceMotion ? 0 : 3.2, ease: [0.17, 0.67, 0.2, 1] }}
        onAnimationComplete={() => {
          if (lastTarget.current !== null) onSpinEnd?.();
        }}
      >
        {segments.map((s, i) => {
          const center = i * slice + slice / 2;
          return (
            <span
              key={s.id}
              className="absolute top-1/2 left-1/2 -mt-2 w-[46%] origin-left pr-2.5 text-right text-xs leading-none font-extrabold text-ink"
              style={{ transform: `rotate(${center - 90}deg)` }}
            >
              {/* En la mitad izquierda se gira el texto para que no quede boca abajo. */}
              <b className={`inline-flex items-center gap-1 ${center > 180 ? "rotate-180" : ""}`}>
                {s.label}
                <CategoryIcon id={s.id} size={14} className="shrink-0" />
              </b>
            </span>
          );
        })}
        <div className="absolute inset-[38%] rounded-full border-4 border-sticker bg-surface" />
      </motion.div>
    </div>
  );
}

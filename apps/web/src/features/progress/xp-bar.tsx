"use client";

import { motion, useReducedMotion } from "motion/react";

/** Barra de XP del nivel actual (fracciones 0–1). Con `from`, se llena animada desde ahí. */
export function XpBar({
  from,
  to,
  label,
  delay = 0,
}: {
  from?: number;
  to: number;
  label: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const animate = from !== undefined && !reduceMotion;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(to * 100)}
      className="h-4 w-full overflow-hidden rounded-full border-2 border-sticker bg-bg-deep"
    >
      <motion.div
        className="h-full rounded-full bg-play"
        initial={{ width: `${(animate ? from : to) * 100}%` }}
        animate={{ width: `${to * 100}%` }}
        transition={{ duration: 0.8, delay, ease: "easeOut" }}
      />
    </div>
  );
}

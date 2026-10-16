"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { Mascot } from "@/components/mascot";

export function HomeIntro() {
  const t = useTranslations("Home");
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="flex flex-col items-center gap-4 text-center"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -6, 0], rotate: [0, -2, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        className="drop-shadow-[0_6px_0_var(--color-sticker)]"
      >
        <Mascot size={150} />
      </motion.div>
      <h1 className="text-5xl font-bold sm:text-6xl">
        {t.rich("title", { accent: (chunks) => <span className="text-accent">{chunks}</span> })}
      </h1>
      <p className="text-lg text-fg-muted">{t("subtitle")}</p>
    </motion.div>
  );
}

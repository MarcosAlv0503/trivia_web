"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";

// Placeholder de la Fase 0: solo verifica i18n, Tailwind y Motion. La estética se decide en la Fase 1.
export function HomeIntro() {
  const t = useTranslations("Home");
  return (
    <motion.div
      className="text-center"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h1 className="text-4xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-lg">{t("subtitle")}</p>
    </motion.div>
  );
}

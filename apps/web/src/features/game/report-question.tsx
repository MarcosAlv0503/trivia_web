"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export const REPORT_REASONS = ["wrong_answer", "ambiguous", "typo", "offensive"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

type Props = {
  /** Envía el reporte al servidor; devuelve si se guardó. */
  onReport: (reason: ReportReason) => Promise<boolean>;
};

/** Botón "Reportar pregunta" que se muestra al revelar la respuesta. */
export function ReportQuestion({ onReport }: Props) {
  const t = useTranslations("Report");
  const [state, setState] = useState<"idle" | "open" | "sending" | "sent" | "error">("idle");

  async function send(reason: ReportReason) {
    setState("sending");
    setState((await onReport(reason)) ? "sent" : "error");
  }

  if (state === "sent" || state === "error") {
    return (
      <p role="status" className={`text-center font-bold ${state === "sent" ? "" : "text-ko"}`}>
        {t(state === "sent" ? "thanks" : "error")}
      </p>
    );
  }

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={() => setState("open")}
        className="self-center text-sm font-bold text-fg-muted underline"
      >
        ⚑ {t("button")}
      </button>
    );
  }

  return (
    <fieldset
      className="grid gap-2 rounded-card bg-surface p-4 sticker"
      disabled={state === "sending"}
    >
      <legend className="float-left mb-1 font-bold">{t("title")}</legend>
      {REPORT_REASONS.map((reason) => (
        <button
          key={reason}
          type="button"
          onClick={() => void send(reason)}
          className="rounded-2xl bg-surface-2 px-4 py-2.5 text-left font-bold sticker disabled:opacity-60"
        >
          {t(`reasons.${reason}`)}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setState("idle")}
        className="justify-self-center pt-1 text-sm font-bold text-fg-muted underline"
      >
        {t("cancel")}
      </button>
    </fieldset>
  );
}

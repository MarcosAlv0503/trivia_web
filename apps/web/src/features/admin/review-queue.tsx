"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Difficulty } from "@trivia/game-core";
import { buttonClassName } from "@/components/button";
import { DifficultyPicker } from "@/features/game/difficulty-picker";
import type { ReportReason } from "@/features/game/report-question";
import { createClient } from "@/lib/supabase/client";

type Translation = { prompt: string; correct: string; wrong: string[] };

/** Forma de lo que devuelve la RPC `admin_review_queue` (los tipos generados solo dicen `Json`). */
export type QueueItem = {
  id: string;
  category: { id: string; color: string };
  difficulty: Difficulty;
  status: "draft" | "approved";
  topical: boolean;
  needsHuman: boolean;
  reviewNote: string | null;
  translations: Record<string, Translation>;
  reports: { reason: ReportReason; locale: string; count: number }[];
};

/** Cola del panel de revisión: preguntas pendientes de revisión humana o reportadas por jugadores. */
export function ReviewQueue({ items }: { items: QueueItem[] }) {
  const t = useTranslations("Admin");
  if (!items.length) return <p className="font-bold text-fg-muted">{t("empty")}</p>;
  return (
    <ul className="grid w-full max-w-2xl gap-4">
      {items.map((item) => (
        <li key={item.id}>
          <ReviewCard item={item} />
        </li>
      ))}
    </ul>
  );
}

function ReviewCard({ item }: { item: QueueItem }) {
  const t = useTranslations("Admin");
  const tReport = useTranslations("Report");
  const tQuick = useTranslations("Quick");
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [editing, setEditing] = useState(false);
  const [translations, setTranslations] = useState(item.translations);
  const [difficulty, setDifficulty] = useState(item.difficulty);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Mensaje de la BD tal cual (p. ej. "respuestas repetidas"): el panel es solo para administradores.
  const [error, setError] = useState<string>();

  const edit = (locale: string, patch: Partial<Translation>) =>
    setTranslations((current) => ({ ...current, [locale]: { ...current[locale]!, ...patch } }));

  async function review(verdict: "approve" | "reject") {
    setBusy(true);
    setError(undefined);
    // Al corregir, primero se guardan los textos (con las validaciones de la importación) y luego se aprueba.
    const update = editing
      ? await supabase.rpc("admin_update_question", {
          question_id: item.id,
          question_difficulty: difficulty,
          translations,
        })
      : null;
    const { error } = update?.error
      ? update
      : await supabase.rpc("admin_review_question", { question_id: item.id, verdict, note });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    // La página vuelve a pedir la cola, ya sin esta pregunta.
    router.refresh();
  }

  return (
    <article className="grid gap-3 rounded-card bg-surface p-5 sticker">
      <div className="flex flex-wrap items-center gap-2 text-sm font-extrabold">
        <span
          className="rounded-full border-2 border-sticker px-3 py-0.5 text-ink"
          style={{ backgroundColor: item.category.color }}
        >
          {item.category.id}
        </span>
        <span>{tQuick(`difficulties.${item.difficulty}`)}</span>
        <span className="text-fg-muted">· {t(`status.${item.status}`)}</span>
        {item.topical && <span className="text-fg-muted">· {tQuick("topical")}</span>}
        {item.needsHuman && (
          <span className="rounded-full bg-accent px-3 py-0.5 text-accent-ink">
            {t("needsHuman")}
          </span>
        )}
      </div>

      {item.reviewNote && (
        <p className="text-sm">
          <span className="font-bold">{t("note")}:</span> {item.reviewNote}
        </p>
      )}
      {item.reports.length > 0 && (
        <ul className="text-sm font-bold text-ko">
          {item.reports.map((r) => (
            <li key={`${r.reason}-${r.locale}`}>
              ⚑ {tReport(`reasons.${r.reason}`)} ({r.locale}) ×{r.count}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <div className="grid gap-4">
          <DifficultyPicker
            name={`difficulty-${item.id}`}
            value={difficulty}
            onChange={setDifficulty}
          />
          {Object.entries(translations).map(([locale, tr]) => (
            <fieldset key={locale} lang={locale} className="grid gap-2">
              <legend className="mb-1 font-bold uppercase">{locale}</legend>
              <textarea
                aria-label={t("prompt")}
                value={tr.prompt}
                onChange={(e) => edit(locale, { prompt: e.target.value })}
                maxLength={300}
                rows={2}
                className="rounded-2xl bg-surface-2 px-4 py-2 font-bold sticker"
              />
              <input
                aria-label={t("correct")}
                value={tr.correct}
                onChange={(e) => edit(locale, { correct: e.target.value })}
                maxLength={120}
                className="rounded-2xl bg-ok px-4 py-2 font-bold text-ink sticker"
              />
              {tr.wrong.map((answer, i) => (
                <input
                  key={i}
                  aria-label={t("wrong", { number: i + 1 })}
                  value={answer}
                  onChange={(e) =>
                    edit(locale, { wrong: tr.wrong.map((w, j) => (j === i ? e.target.value : w)) })
                  }
                  maxLength={120}
                  className="rounded-2xl bg-surface-2 px-4 py-2 font-bold sticker"
                />
              ))}
            </fieldset>
          ))}
        </div>
      ) : (
        Object.entries(item.translations).map(([locale, tr]) => (
          <div key={locale} lang={locale} className="grid gap-1.5">
            <p className="font-display text-lg font-bold">
              <span className="mr-2 text-sm text-fg-muted uppercase">{locale}</span>
              {tr.prompt}
            </p>
            <ul className="flex flex-wrap gap-1.5 text-sm font-bold">
              <li className="rounded-xl bg-ok px-3 py-1 text-ink">✓ {tr.correct}</li>
              {tr.wrong.map((answer) => (
                <li key={answer} className="rounded-xl bg-surface-2 px-3 py-1">
                  {answer}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      <input
        aria-label={t("verdictNote")}
        placeholder={t("verdictNote")}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        className="rounded-2xl bg-surface-2 px-4 py-2 sticker"
      />
      {error && (
        <p role="alert" className="font-bold text-ko">
          {t("error")} {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void review("approve")}
          className={buttonClassName("primary")}
        >
          {t(editing ? "saveApprove" : "approve")}
        </button>
        {!editing && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void review("reject")}
            className={buttonClassName("danger")}
          >
            {t("reject")}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setEditing(!editing);
            setTranslations(item.translations);
            setDifficulty(item.difficulty);
          }}
          className={buttonClassName("secondary")}
        >
          {t(editing ? "cancelEdit" : "edit")}
        </button>
      </div>
    </article>
  );
}

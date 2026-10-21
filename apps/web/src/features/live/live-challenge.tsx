"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Difficulty } from "@trivia/game-core";
import { buttonClassName } from "@/components/button";
import { DifficultyPicker } from "@/features/game/difficulty-picker";
import { createClient } from "@/lib/supabase/client";
import { inviteLive, type LiveInviteError } from "./invite";

/** Elegir la dificultad y retar en vivo; al enviar la invitación se pasa a la pantalla de espera. */
export function LiveChallenge({
  friend,
  onCancel,
}: {
  friend: { id: string; username: string };
  onCancel: () => void;
}) {
  const t = useTranslations("Live");
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<LiveInviteError>();

  async function invite() {
    setSending(true);
    setError(undefined);
    const sent = await inviteLive(supabase, friend.id, difficulty);
    if ("id" in sent) {
      router.push(`/live/${sent.id}`);
      return;
    }
    setError(sent.error);
    setSending(false);
  }

  return (
    <div className="flex flex-col gap-3 px-1 pb-1">
      <p className="font-bold">{t("pickDifficulty")}</p>
      <DifficultyPicker
        name={`live-difficulty-${friend.id}`}
        value={difficulty}
        onChange={setDifficulty}
      />
      {error && (
        <p role="alert" className="font-bold text-ko">
          {t(`errors.${error}`, { name: friend.username })}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={sending}
          onClick={() => void invite()}
          className={buttonClassName("play", "flex-1 py-2.5 text-xl")}
        >
          {t("go")}
        </button>
        <button type="button" onClick={onCancel} className={buttonClassName("secondary")}>
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

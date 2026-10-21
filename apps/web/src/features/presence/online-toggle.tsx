"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

/** "Mostrar cuando estoy en línea": apagado, nadie te ve conectado ni te reta en vivo, y tú no ves a nadie. */
export function OnlineToggle({ userId, initial }: { userId: string; initial: boolean }) {
  const t = useTranslations("Presence");
  const [supabase] = useState(createClient);
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle(value: boolean) {
    setBusy(true);
    setError(false);
    const { error } = await supabase
      .from("profiles")
      .update({ show_online: value })
      .eq("id", userId);
    if (error) setError(true);
    else setOn(value);
    setBusy(false);
  }

  return (
    <section className="flex w-full max-w-md flex-col gap-3 border-t-2 border-surface-2 pt-6">
      <h2 className="font-display text-lg font-bold">{t("title")}</h2>
      <label className="flex items-center gap-3 font-bold">
        <input
          type="checkbox"
          className="size-5 accent-accent"
          checked={on}
          disabled={busy}
          onChange={(e) => void toggle(e.target.checked)}
        />
        {t("showOnline")}
      </label>
      <p className="text-fg-muted">{t("description")}</p>
      {error && (
        <p role="alert" className="font-bold text-ko">
          {t("error")}
        </p>
      )}
    </section>
  );
}

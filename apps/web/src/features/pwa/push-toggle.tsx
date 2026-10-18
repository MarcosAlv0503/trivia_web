"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/components/button";
import { createClient } from "@/lib/supabase/client";
import {
  VAPID_PUBLIC_KEY,
  currentPushSubscription,
  disablePush,
  enablePush,
  isPushSupported,
  savePushSubscription,
} from "./push";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

/** Activar o desactivar los avisos push en este dispositivo. */
export function PushToggle() {
  const t = useTranslations("Push");
  const [supabase] = useState(createClient);
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!isPushSupported()) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const subscription = await currentPushSubscription();
      // Se vuelve a guardar: si el navegador lo usaba otra cuenta, los avisos pasan a esta.
      if (subscription) await savePushSubscription(supabase, subscription);
      setState(subscription ? "on" : "off");
    })();
  }, [supabase]);

  async function toggle() {
    setBusy(true);
    if (state === "on") {
      await disablePush(supabase);
      setState("off");
    } else {
      const enabled = await enablePush(supabase).catch(() => false);
      setState(enabled ? "on" : Notification.permission === "denied" ? "denied" : "off");
    }
    setBusy(false);
  }

  if (!VAPID_PUBLIC_KEY || state === "loading") return null;

  return (
    <section className="flex w-full max-w-md flex-col gap-3 border-t-2 border-surface-2 pt-6">
      <h2 className="font-display text-lg font-bold">{t("title")}</h2>
      <p className="text-fg-muted">
        {t(state === "on" || state === "off" ? "description" : state)}
      </p>
      {(state === "on" || state === "off") && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggle()}
          className={buttonClassName(state === "on" ? "secondary" : "primary", "self-start")}
        >
          {t(state === "on" ? "disable" : "enable")}
        </button>
      )}
    </section>
  );
}

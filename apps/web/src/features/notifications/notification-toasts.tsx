"use client";

import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

/** Evento de ventana que reemite cada aviso, para que las pantallas abiertas (p. ej. un duelo) se actualicen. */
export const NOTIFICATION_EVENT = "trivia:notification";

export type NotificationRow = {
  id: number;
  user_id: string;
  kind: "friend_request" | "friend_accepted" | "duel_turn" | "duel_finished";
  actor_name: string;
  duel_id: string | null;
  created_at: string;
};

const TOAST_MS = 6000;
const MAX_TOASTS = 3;

/** Avisos en vivo (Realtime): solo llegan los del propio usuario, la RLS de `notifications` lo garantiza. */
export function NotificationToasts({ userId }: { userId: string }) {
  const t = useTranslations("Notifications");
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [toasts, setToasts] = useState<NotificationRow[]>([]);

  const dismiss = (id: number) => setToasts((current) => current.filter((x) => x.id !== id));

  const onInsert = useEffectEvent((row: NotificationRow) => {
    setToasts((current) => [...current.slice(1 - MAX_TOASTS), row]);
    setTimeout(() => dismiss(row.id), TOAST_MS);
    window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail: row }));
    // Recarga los datos de servidor de la página actual (lista de duelos, solicitudes...).
    router.refresh();
  });

  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onInsert(payload.new as NotificationRow),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 p-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl bg-surface-2 p-1 pl-4 sticker"
          >
            <Link
              href={toast.duel_id ? `/duel/${toast.duel_id}` : "/friends"}
              onClick={() => dismiss(toast.id)}
              className="flex-1 py-2 font-bold"
            >
              {t(toast.kind, { name: toast.actor_name })}
            </Link>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t("close")}
              className="grid size-10 shrink-0 place-items-center rounded-full font-bold"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

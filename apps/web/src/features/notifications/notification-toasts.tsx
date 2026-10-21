"use client";

import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { LIVE } from "@trivia/game-core";
import { buttonClassName } from "@/components/button";
import { CloseIcon } from "@/components/icons";

/** Evento de ventana que reemite cada aviso, para que las pantallas abiertas (p. ej. un duelo) se actualicen. */
export const NOTIFICATION_EVENT = "trivia:notification";

export type NotificationRow = {
  id: number;
  user_id: string;
  kind:
    | "friend_request"
    | "friend_accepted"
    | "duel_turn"
    | "duel_finished"
    | "duel_deadline"
    | "live_invite";
  actor_name: string;
  /** Duelo por turnos o, en `live_invite`, duelo relámpago. */
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
    // La invitación en vivo se queda mientras se puede aceptar.
    const lifetime =
      row.kind === "live_invite"
        ? LIVE.inviteSeconds * 1000 - (Date.now() - new Date(row.created_at).getTime())
        : TOAST_MS;
    setTimeout(() => dismiss(row.id), lifetime);
    window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail: row }));
    // Recarga los datos de servidor de la página actual (lista de duelos, solicitudes...).
    router.refresh();
  });

  async function answerInvite(toast: NotificationRow, accept: boolean) {
    dismiss(toast.id);
    await supabase.rpc("answer_live_invite", { duel_id: toast.duel_id!, accept });
    // Si ya no estaba disponible, la pantalla del duelo lo explica.
    if (accept) router.push(`/live/${toast.duel_id}`);
  }

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
            {toast.kind === "live_invite" ? (
              <div className="flex flex-1 flex-wrap items-center gap-2 py-1">
                <p className="flex-1 font-bold">{t(toast.kind, { name: toast.actor_name })}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void answerInvite(toast, true)}
                    className={buttonClassName("play", "px-4 py-2 text-base")}
                  >
                    {t("accept")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void answerInvite(toast, false)}
                    className={buttonClassName("secondary", "px-4 py-2 text-base")}
                  >
                    {t("decline")}
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href={toast.duel_id ? `/duel/${toast.duel_id}` : "/friends"}
                onClick={() => dismiss(toast.id)}
                className="flex-1 py-2 font-bold"
              >
                {t(toast.kind, { name: toast.actor_name })}
              </Link>
            )}
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t("close")}
              className="grid size-10 shrink-0 place-items-center rounded-full font-bold"
            >
              <CloseIcon size={18} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

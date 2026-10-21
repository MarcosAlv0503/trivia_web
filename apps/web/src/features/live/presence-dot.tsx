import { useTranslations } from "next-intl";
import type { Presence } from "@/features/friends/types";

/** Punto de estado de un amigo: verde en línea, rosa jugando (desconectado no se muestra). */
export function PresenceDot({ presence }: { presence: Presence }) {
  const t = useTranslations("Friends");
  if (presence === "offline") return null;
  return (
    <span className="flex items-center gap-1 text-sm font-bold whitespace-nowrap text-fg-muted">
      <span
        aria-hidden="true"
        className={`size-3 rounded-full border-2 border-sticker ${presence === "online" ? "bg-ok" : "bg-accent"}`}
      />
      {t(presence)}
    </span>
  );
}

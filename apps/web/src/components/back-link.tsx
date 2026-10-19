import Link from "next/link";
import { ArrowLeftIcon } from "./icons";

/** Volver: botón redondo con flecha arriba a la izquierda, como el de cerrar la partida. `label` llega ya traducido. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-lg font-bold sticker"
    >
      <ArrowLeftIcon size={22} />
    </Link>
  );
}

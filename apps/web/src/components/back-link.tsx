import Link from "next/link";

/** Volver: botón redondo con flecha arriba a la izquierda, como el ✕ de la partida. `label` llega ya traducido. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-lg font-bold sticker"
    >
      <svg
        viewBox="0 0 24 24"
        width={22}
        height={22}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5M11 5.5 4.5 12l6.5 6.5" />
      </svg>
    </Link>
  );
}

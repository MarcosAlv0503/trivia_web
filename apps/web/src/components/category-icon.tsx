// Icono de cada categoría, para no depender solo del color (accesibilidad). Las claves coinciden con
// `public.categories.id`; una categoría sin dibujo usa el genérico. Trazo en currentColor.

const ICONS: Record<string, React.ReactNode> = {
  // Globo terráqueo.
  geography: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </>
  ),
  // Reloj de arena.
  history: (
    <>
      <path d="M6 3h12M6 21h12" />
      <path d="M7.5 3v2.5c0 3 4.5 4.5 4.5 6.5s-4.5 3.5-4.5 6.5V21M16.5 3v2.5c0 3-4.5 4.5-4.5 6.5s4.5 3.5 4.5 6.5V21" />
      <path d="M9 19.5c1-2 5-2 6 0z" fill="currentColor" />
    </>
  ),
  // Matraz.
  science: (
    <>
      <path d="M9 3h6M10 3v6.5L4.8 18.2A1.9 1.9 0 0 0 6.5 21h11a1.9 1.9 0 0 0 1.7-2.8L14 9.5V3" />
      <path
        d="M7.2 15.5h9.6l1.6 2.9a.9.9 0 0 1-.8 1.4H6.4a.9.9 0 0 1-.8-1.4z"
        fill="currentColor"
      />
    </>
  ),
  // Paleta de pintor.
  "art-literature": (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.7-1 1.2-2-.6-1.2.2-2.5 1.5-2.5H17a4 4 0 0 0 4-4C21 7.1 17 3 12 3z" />
      <circle cx="7.6" cy="11.6" r="1.2" fill="currentColor" />
      <circle cx="10.2" cy="7.6" r="1.2" fill="currentColor" />
      <circle cx="14.8" cy="8" r="1.2" fill="currentColor" />
    </>
  ),
  // Claqueta.
  entertainment: (
    <>
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M3 4h18v5H3z" />
      <path d="M8.5 4 6 9M14 4l-2.5 5M19.5 4 17 9" />
    </>
  ),
  // Balón.
  sports: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18M5.6 5.6a9 9 0 0 1 0 12.8M18.4 5.6a9 9 0 0 0 0 12.8" />
    </>
  ),
  // Chip.
  technology: (
    <>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
      <rect x="10" y="10" width="4" height="4" rx=".5" fill="currentColor" />
      <path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21" />
    </>
  ),
};

// Interrogación, para categorías nuevas que aún no tienen dibujo.
const FALLBACK = (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.5v.7" />
    <circle cx="12" cy="17" r="1.2" fill="currentColor" stroke="none" />
  </>
);

export function CategoryIcon({
  id,
  size = 20,
  className,
}: {
  id: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {ICONS[id] ?? FALLBACK}
    </svg>
  );
}

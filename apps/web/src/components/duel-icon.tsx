// Icono del duelo: dos espadas cruzadas a color, con borde de pegatina.
function Sword({ angle }: { angle: number }) {
  return (
    <g transform={`rotate(${angle} 12 12)`}>
      <path d="M12 1.8 13.7 4v11h-3.4V4z" fill="var(--color-fg)" />
      <path d="M12 4.5v9.5" stroke="var(--color-fg-muted)" strokeWidth="0.8" />
      <rect x="8.2" y="15" width="7.6" height="2.2" rx="1.1" fill="var(--color-accent)" />
      <rect x="11" y="17.2" width="2" height="3.4" fill="var(--color-play)" />
      <circle cx="12" cy="21.5" r="1.5" fill="var(--color-accent)" />
    </g>
  );
}

export function DuelIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke="var(--color-sticker)"
      strokeWidth="1.1"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <Sword angle={-45} />
      <Sword angle={45} />
    </svg>
  );
}

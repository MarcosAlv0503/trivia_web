// Mascota ajolote provisional (placeholder hasta tener arte definitivo).
const BODY = "#F9A8C9";
const GILLS = "#E8628F";
const INK = "#2B2140";

// [x, y, rotación] de las branquias del lado izquierdo; el derecho es su reflejo.
const GILL_FRONDS: [number, number, number][] = [
  [24, 40, -35],
  [16, 52, -5],
  [21, 64, 25],
];

export function Mascot({ size = 160, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g fill={GILLS}>
        {GILL_FRONDS.map(([x, y, r]) => (
          <g key={y}>
            <ellipse cx={x} cy={y} rx="12" ry="5" transform={`rotate(${r} ${x} ${y})`} />
            <ellipse
              cx={100 - x}
              cy={y}
              rx="12"
              ry="5"
              transform={`rotate(${-r} ${100 - x} ${y})`}
            />
          </g>
        ))}
      </g>
      <ellipse cx="50" cy="88" rx="22" ry="12" fill={BODY} />
      <ellipse cx="50" cy="56" rx="30" ry="25" fill={BODY} />
      <ellipse cx="33" cy="65" rx="5" ry="3" fill={GILLS} opacity="0.4" />
      <ellipse cx="67" cy="65" rx="5" ry="3" fill={GILLS} opacity="0.4" />
      <circle cx="39" cy="54" r="4.5" fill={INK} />
      <circle cx="61" cy="54" r="4.5" fill={INK} />
      <circle cx="40.5" cy="52.5" r="1.5" fill="#fff" />
      <circle cx="62.5" cy="52.5" r="1.5" fill="#fff" />
      <path
        d="M43 64 Q50 71 57 64"
        fill="none"
        stroke={INK}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

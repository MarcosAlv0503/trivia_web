// Mascota ajolote provisional (placeholder hasta tener arte definitivo).
const BODY = "#F9A8C9";
const GILLS = "#E8628F";
const INK = "#2B2140";
const STEEL = "#B9C7D0";
const SWEAT = "#8FD8FF";

// [x, y, rotación] de las branquias del lado izquierdo; el derecho es su reflejo.
const GILL_FRONDS: [number, number, number][] = [
  [24, 40, -35],
  [16, 52, -5],
  [21, 64, 25],
];

/**
 * Poses de los finales de partida: `party` (victoria, con gorro de fiesta), `tired` (derrota: agotado y sudando,
 * pero sonriendo con la cabeza alta), `bored` (empate simple: bostezando) y `knight` (empate legendario: casco y
 * espada).
 */
export type MascotVariant = "default" | "party" | "tired" | "bored" | "knight";

// Las piezas son funciones que devuelven SVG (no componentes): el icono de la app lo dibuja ImageResponse, que solo
// admite elementos SVG.
export function Mascot({
  size = 160,
  className,
  variant = "default",
}: {
  size?: number;
  className?: string;
  variant?: MascotVariant;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {variant === "knight" && sword()}
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
      <ellipse
        cx="33"
        cy="65"
        rx="5"
        ry="3"
        fill={GILLS}
        opacity={variant === "tired" ? 0.75 : 0.4}
      />
      <ellipse
        cx="67"
        cy="65"
        rx="5"
        ry="3"
        fill={GILLS}
        opacity={variant === "tired" ? 0.75 : 0.4}
      />
      {face(variant)}
      {variant === "party" && partyHat()}
      {variant === "knight" && helmet()}
      {variant === "tired" && sweatDrops()}
      {variant === "bored" && snore()}
    </svg>
  );
}

const line = { fill: "none", stroke: INK, strokeWidth: 2.4, strokeLinecap: "round" } as const;

function face(variant: MascotVariant) {
  switch (variant) {
    case "party":
      // Ojos de alegría (arcos) y boca abierta riendo.
      return (
        <>
          <path d="M35 55 Q39 49 43 55" {...line} />
          <path d="M57 55 Q61 49 65 55" {...line} />
          <path d="M42 63 Q50 76 58 63 Z" fill={INK} />
          <path d="M45.5 68.5 Q50 72 54.5 68.5" fill={GILLS} />
        </>
      );
    case "tired":
      // Párpados a media asta, cejas firmes y sonrisa: agotado pero orgulloso.
      return (
        <>
          <path d="M34.5 55 a4.5 4.5 0 0 0 9 0 Z" fill={INK} />
          <path d="M56.5 55 a4.5 4.5 0 0 0 9 0 Z" fill={INK} />
          <path d="M33 54.5 h11.5 M55.5 54.5 h11.5" {...line} />
          <path d="M34 47 l9 -2 M66 47 l-9 -2" {...line} strokeWidth={2} />
          <path d="M44 64 Q50 69 56 64" {...line} />
        </>
      );
    case "bored":
      // Ojos cerrados y bostezo.
      return (
        <>
          <path d="M35 55 h8 M57 55 h8" {...line} />
          <ellipse cx="50" cy="67" rx="4.5" ry="6" fill={INK} />
        </>
      );
    case "knight":
      // Mirada decidida bajo el casco.
      return (
        <>
          <circle cx="39" cy="56" r="4" fill={INK} />
          <circle cx="61" cy="56" r="4" fill={INK} />
          <circle cx="40.3" cy="54.7" r="1.3" fill="#fff" />
          <circle cx="62.3" cy="54.7" r="1.3" fill="#fff" />
          <path d="M34 50 l9 2 M66 50 l-9 2" {...line} strokeWidth={2.2} />
          <path d="M43 65 Q50 70 57 64" {...line} />
        </>
      );
    default:
      return (
        <>
          <circle cx="39" cy="54" r="4.5" fill={INK} />
          <circle cx="61" cy="54" r="4.5" fill={INK} />
          <circle cx="40.5" cy="52.5" r="1.5" fill="#fff" />
          <circle cx="62.5" cy="52.5" r="1.5" fill="#fff" />
          <path d="M43 64 Q50 71 57 64" {...line} />
        </>
      );
  }
}

function partyHat() {
  return (
    <g stroke="var(--color-sticker)" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M38 34 L50 6 L62 34 Z" fill="var(--color-play)" />
      <path d="M42.5 24 L57.5 24 M40 30 L60 30" stroke="var(--color-accent)" strokeWidth="2.6" />
      <circle cx="50" cy="6" r="4" fill="var(--color-accent)" />
    </g>
  );
}

function helmet() {
  return (
    <g stroke="var(--color-sticker)" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M50 4 Q60 6 58 20 L50 19 Z" fill="var(--color-accent)" />
      <path d="M21 47 Q21 20 50 20 Q79 20 79 47 Z" fill={STEEL} />
      <path d="M21 47 h58" strokeWidth="3" />
      <path d="M50 21 v26" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" />
      <circle cx="29" cy="42" r="1.4" fill="var(--color-sticker)" />
      <circle cx="71" cy="42" r="1.4" fill="var(--color-sticker)" />
    </g>
  );
}

function sword() {
  return (
    <g
      stroke="var(--color-sticker)"
      strokeWidth="1.6"
      strokeLinejoin="round"
      transform="rotate(18 88 70)"
    >
      <path d="M88 8 L92 14 V64 H84 V14 Z" fill={STEEL} />
      <rect x="78" y="63" width="20" height="5" rx="2.5" fill="var(--color-play)" />
      <rect x="85.5" y="68" width="5" height="12" fill="var(--color-accent)" />
      <circle cx="88" cy="83" r="3.5" fill="var(--color-play)" />
    </g>
  );
}

function sweatDrops() {
  return (
    <g fill={SWEAT} stroke="var(--color-sticker)" strokeWidth="1.2">
      <path d="M80 30 Q84 37 80 40 Q76 37 80 30 Z" />
      <path d="M21 35 Q24 40.5 21 43 Q18 40.5 21 35 Z" />
    </g>
  );
}

/** Tres "z" dibujadas (no texto) subiendo en diagonal. */
function snore() {
  return (
    <g
      fill="none"
      stroke="var(--color-fg)"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M68 30 h6 l-6 6 h6" />
      <path d="M78 20 h7 l-7 7 h7" />
      <path d="M88 9 h8 l-8 8 h8" />
    </g>
  );
}

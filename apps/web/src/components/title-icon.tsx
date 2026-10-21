import type { TitleLevel } from "@trivia/game-core";

// Icono de cada título de nivel (las claves son el nivel con el que se gana, como en messages > Progress.titles).
// A color, con los tokens de globals.css y borde de pegatina, como los iconos de modo de juego.

const BORDER = "var(--color-sticker)";
const SHINE = { stroke: "#fff", strokeOpacity: 0.6, strokeWidth: 1.2, fill: "none" } as const;

/** Trazo de color con borde de pegatina (dos pasadas: borde ancho debajo). */
function Line({ d, color, width = 1.6 }: { d: string; color: string; width?: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={BORDER} strokeWidth={width + 1.6} strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
    </>
  );
}

function Sparkle({ x, y, r = 2.2 }: { x: number; y: number; r?: number }) {
  const k = r * 0.25;
  return (
    <path
      d={`M${x} ${y - r}C${x + k} ${y - k} ${x + k} ${y - k} ${x + r} ${y}C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + r}C${x - k} ${y + k} ${x - k} ${y + k} ${x - r} ${y}C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - r}z`}
      fill="var(--color-play)"
      strokeWidth={0.8}
    />
  );
}

/** Cabeza de ajolote de frente con branquias, centrada en (12, 14). */
function AxolotlHead() {
  return (
    <>
      {[
        "M6.4 11.6 2.6 8.6",
        "M5.6 13.6 1.8 13.2",
        "M6.2 15.8 2.8 17.8",
        "M17.6 11.6l3.8-3",
        "M18.4 13.6l3.8-.4",
        "M17.8 15.8l3.4 2",
      ].map((d) => (
        <Line key={d} d={d} color="var(--color-ko)" width={1.8} />
      ))}
      <ellipse cx="12" cy="14" rx="7" ry="5.6" fill="var(--color-accent)" />
      <circle cx="9.3" cy="13" r="1.1" fill="var(--color-ink)" stroke="none" />
      <circle cx="14.7" cy="13" r="1.1" fill="var(--color-ink)" stroke="none" />
      <path d="M10 16.1q2 1.4 4 0" fill="none" stroke="var(--color-ink)" strokeWidth={0.9} />
    </>
  );
}

const ICONS: Record<TitleLevel, React.ReactNode> = {
  // Huevito: huevo gelatinoso con el embrión dentro.
  1: (
    <>
      <circle cx="12" cy="12" r="9.5" fill="var(--color-fg-muted)" fillOpacity={0.55} />
      <Line d="M8.6 8.4 7.4 7.2" color="var(--color-ko)" width={1.1} />
      <Line d="M10 7.6 9.6 6.1" color="var(--color-ko)" width={1.1} />
      <path
        d="M13.4 13.6c1.8 1 2.2 3.1.8 4.2-1.1.8-2.7.7-3.5-.3 1.3.1 2.3-.2 2.7-1 .4-.8.3-1.8 0-2.9z"
        fill="var(--color-accent)"
      />
      <circle cx="11.4" cy="11.6" r="3.9" fill="var(--color-accent)" />
      <circle cx="12.6" cy="10.8" r="1" fill="var(--color-ink)" stroke="none" />
      <path d="M6.6 9.4a6 6 0 0 1 3-3.4" {...SHINE} strokeLinecap="round" />
    </>
  ),
  // Larva curiosa: de perfil, con un ojo enorme y las primeras branquias.
  5: (
    <>
      <Line d="M10.4 8.2 9.6 5" color="var(--color-ko)" width={1.3} />
      <Line d="M12.4 8.8l.6-3.2" color="var(--color-ko)" width={1.3} />
      <path
        d="M2.5 13c0-3.1 2.8-5.2 6.4-5.2 3 0 5 1.5 7 3.1l4.2-2.3c.6-.3 1.3.2 1 .9L19.8 13l1.3 3.5c.3.7-.4 1.2-1 .9l-4.2-2.3c-2 1.6-4 3.1-7 3.1-3.6 0-6.4-2.1-6.4-5.2z"
        fill="var(--color-accent)"
      />
      <circle cx="7.6" cy="11.8" r="2.6" fill="var(--color-fg)" />
      <circle cx="8.1" cy="12" r="1.3" fill="var(--color-ink)" stroke="none" />
      <circle cx="8.6" cy="11.4" r="0.45" fill="#fff" stroke="none" />
      <path d="M11 15.4q1.3.7 2.6 0" fill="none" strokeWidth={0.9} />
    </>
  ),
  // Branquias inquietas: cabeza de ajolote con las branquias rosas.
  10: <AxolotlHead />,
  // Promesa de la laguna: nenúfar con un brote.
  15: (
    <>
      <path d="M12 17.4 20.4 15.4A9.2 4.8 0 1 1 18.8 13.9z" fill="var(--color-ok)" />
      <Line d="M12 16.6V9" color="var(--color-ok)" width={1.4} />
      <path d="M12 10.6c-3.3 0-5-1.7-5.2-4.6 3 0 5 1.6 5.2 4.6z" fill="var(--color-ok)" />
      <path d="M12 9c.3-3.1 2.3-4.8 5.4-4.8-.2 3.1-2.3 4.8-5.4 4.8z" fill="var(--color-ok)" />
      <Sparkle x={19.5} y={4.5} />
    </>
  ),
  // Cerebrito: cerebro rosa con un destello.
  20: (
    <>
      <path
        d="M12 6.2c-1-1.3-3.4-1.6-4.7-.3-1.6-.2-3 1.3-2.8 2.9-1.5.8-1.9 2.8-.9 4.1-.8 1.4-.3 3.3 1.2 3.9.2 1.7 1.9 2.8 3.5 2.4.9 1.1 2.7 1.2 3.7.2z"
        fill="var(--color-accent)"
      />
      <path
        d="M12 6.2c1-1.3 3.4-1.6 4.7-.3 1.6-.2 3 1.3 2.8 2.9 1.5.8 1.9 2.8.9 4.1.8 1.4.3 3.3-1.2 3.9-.2 1.7-1.9 2.8-3.5 2.4-.9 1.1-2.7 1.2-3.7.2z"
        fill="var(--color-accent)"
      />
      <path
        d="M8.4 9.4c1 .2 1.6 1 1.5 2M7.4 14c1.2-.3 2.2.3 2.6 1.3M15.6 9.4c-1 .2-1.6 1-1.5 2M16.6 14c-1.2-.3-2.2.3-2.6 1.3"
        fill="none"
        strokeWidth={0.9}
        strokeLinecap="round"
      />
      <Sparkle x={20} y={3.6} />
    </>
  ),
  // Sabelotodo: birrete con borla.
  25: (
    <>
      <path
        d="M6.5 11v4.2c0 1.6 2.5 2.8 5.5 2.8s5.5-1.2 5.5-2.8V11L12 13.5z"
        fill="var(--color-accent)"
      />
      <path d="M12 4 22 8.5 12 13 2 8.5z" fill="var(--color-accent)" />
      <path d="M5 8.4 12 5.3" {...SHINE} strokeLinecap="round" />
      <Line d="M12 8.5 19 10.4V15" color="var(--color-play)" width={1.1} />
      <circle cx="19" cy="16.4" r="1.6" fill="var(--color-play)" />
    </>
  ),
  // Enciclopedia andante: libro abierto con marcapáginas.
  30: (
    <>
      <path d="M1.8 7v13c4-.5 7.6 0 10.2 1.2 2.6-1.2 6.2-1.7 10.2-1.2V7z" fill="var(--color-ok)" />
      <path d="M12 6.5C9.8 5 6.6 4.6 3 5v13c3.6-.4 6.8 0 9 1.5z" fill="var(--color-fg)" />
      <path d="M12 6.5c2.2-1.5 5.4-1.9 9-1.5v13c-3.6-.4-6.8 0-9 1.5z" fill="var(--color-fg)" />
      <path
        d="M5 9c1.8-.1 3.5.2 5 .9M5 12c1.8-.1 3.5.2 5 .9M5 15c1.8-.1 3.5.2 5 .9M19 12c-1.8-.1-3.5.2-5 .9M19 15c-1.8-.1-3.5.2-5 .9"
        fill="none"
        stroke="var(--color-fg-muted)"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <path d="M15.4 5.4v5.4l1.4-1.1 1.4 1.1V5" fill="var(--color-accent)" strokeWidth={0.9} />
    </>
  ),
  // Mente brillante: bombilla encendida.
  35: (
    <>
      {["M3.4 4.4l1.6 1.4", "M20.6 4.4 19 5.8", "M1.6 10.4h2", "M22.4 10.4h-2"].map((d) => (
        <Line key={d} d={d} color="var(--color-play)" width={1.4} />
      ))}
      <path
        d="M12 2.8a6.6 6.6 0 0 0-3.9 11.9c.7.5 1.1 1.3 1.1 2.1v.9h5.6v-.9c0-.8.4-1.6 1.1-2.1A6.6 6.6 0 0 0 12 2.8z"
        fill="var(--color-play)"
      />
      <rect x="9.2" y="17.7" width="5.6" height="2.8" rx="1" fill="var(--color-fg-muted)" />
      <path d="M10.6 20.5h2.8l-.6 1.3h-1.6z" fill="var(--color-fg-muted)" />
      <path
        d="M10 11 11 12.6 12 11 13 12.6 14 11"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={0.9}
      />
      <path d="M8.6 7a4.2 4.2 0 0 1 2.6-1.8" {...SHINE} strokeLinecap="round" />
    </>
  ),
  // Leyenda de la laguna: corona sobre una onda de agua.
  40: (
    <>
      <Line
        d="M2 20c1.7-1.3 3.3-1.3 5 0s3.3 1.3 5 0 3.3-1.3 5 0 3.3 1.3 5 0"
        color="var(--color-fg-muted)"
        width={1.6}
      />
      <path d="M4 15.5 3 6l4.8 3.7L12 3.5l4.2 6.2L21 6l-1 9.5z" fill="var(--color-play)" />
      <circle cx="12" cy="11.8" r="1.4" fill="var(--color-accent)" />
      <circle cx="7.4" cy="12.6" r="1" fill="var(--color-ok)" />
      <circle cx="16.6" cy="12.6" r="1" fill="var(--color-ok)" />
    </>
  ),
  // Eminencia: medalla con lazo.
  45: (
    <>
      <path d="M6.5 1.8h4.2l2.6 7.4H9.1z" fill="var(--color-accent)" />
      <path d="M17.5 1.8h-4.2l-2.6 7.4h4.2z" fill="var(--color-ko)" />
      <circle cx="12" cy="15" r="6.6" fill="var(--color-play)" />
      <circle cx="12" cy="15" r="4.4" fill="none" strokeWidth={0.8} />
      <path
        d="m12 12.2 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z"
        fill="var(--color-fg)"
        strokeWidth={0.7}
      />
    </>
  ),
  // Oráculo de la laguna: bola de cristal con un ajolote dentro.
  50: (
    <>
      <path d="M6.2 22 7.8 18h8.4l1.6 4z" fill="var(--color-play)" />
      <circle cx="12" cy="10.6" r="8.6" fill="var(--color-fg-muted)" fillOpacity={0.5} />
      <g transform="translate(12 11.4) scale(0.55) translate(-12 -14)" strokeWidth={1.8}>
        <AxolotlHead />
      </g>
      <path d="M6.4 8a6.4 6.4 0 0 1 3.4-3.8" {...SHINE} strokeLinecap="round" />
      <Sparkle x={16.4} y={5.6} r={1.4} />
    </>
  ),
};

/** Icono del título vigente (`level` = nivel con el que se ganó el título: 1, 5, 10… 50). */
export function TitleIcon({
  level,
  size = 24,
  className,
}: {
  level: TitleLevel;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      stroke={BORDER}
      strokeWidth={1.2}
      strokeLinejoin="round"
    >
      {ICONS[level]}
    </svg>
  );
}

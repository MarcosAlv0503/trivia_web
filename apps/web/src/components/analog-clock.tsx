"use client";

// Reloj analógico de la partida: una aguja da la vuelta en `totalMs` y el sector recorrido se colorea (rojo en los
// últimos segundos). Alrededor, un anillo fino que se vacía con el tiempo de la pregunta.
// Presentacional: recibe los tiempos ya calculados (se actualizan a menudo; las transiciones CSS suavizan los saltos).

const FACE_R = 46;
const RING_R = 55;
const RING_LENGTH = 2 * Math.PI * RING_R;
// Sector con un círculo de radio la mitad y trazo del doble: el trazo rellena el disco y su longitud, el ángulo.
const SECTOR_R = FACE_R / 2;
const SECTOR_LENGTH = 2 * Math.PI * SECTOR_R;
const SMOOTH = "250ms linear";

type Props = {
  remainingMs: number;
  totalMs: number;
  /** Fracción (0–1) que le queda a la pregunta; `null` sin pregunta en curso (anillo lleno y apagado). */
  questionLeft: number | null;
  warning: boolean;
  /** Texto accesible, ya traducido (p. ej. "Quedan 42 s"). */
  label: string;
  size?: number;
};

export function AnalogClock({
  remainingMs,
  totalMs,
  questionLeft,
  warning,
  label,
  size = 132,
}: Props) {
  const elapsed = Math.min(1, Math.max(0, 1 - remainingMs / totalMs));
  const ring = questionLeft ?? 1;
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="timer"
      aria-label={label}
      className="drop-shadow-[0_5px_0_var(--color-sticker)]"
    >
      <circle
        cx="60"
        cy="60"
        r={RING_R}
        fill="none"
        stroke="var(--color-bg-deep)"
        strokeWidth="6"
      />
      <circle
        cx="60"
        cy="60"
        r={RING_R}
        fill="none"
        stroke={questionLeft === null ? "var(--color-surface-2)" : "var(--color-play)"}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={RING_LENGTH}
        strokeDashoffset={RING_LENGTH * (1 - ring)}
        transform="rotate(-90 60 60)"
        style={{ transition: `stroke-dashoffset ${SMOOTH}` }}
      />
      <circle
        cx="60"
        cy="60"
        r={FACE_R}
        fill="var(--color-surface-2)"
        stroke="var(--color-sticker)"
        strokeWidth="3"
      />
      <circle
        cx="60"
        cy="60"
        r={SECTOR_R}
        fill="none"
        stroke={warning ? "var(--color-ko)" : "var(--color-accent)"}
        strokeOpacity={warning ? 0.85 : 0.55}
        strokeWidth={FACE_R - 1.5}
        strokeDasharray={`${SECTOR_LENGTH * elapsed} ${SECTOR_LENGTH}`}
        transform="rotate(-90 60 60)"
        style={{ transition: `stroke-dasharray ${SMOOTH}, stroke ${SMOOTH}` }}
      />
      {Array.from({ length: 12 }, (_, i) => (
        <line
          key={i}
          x1="60"
          y1={i % 3 === 0 ? 19 : 21}
          x2="60"
          y2="25"
          stroke="var(--color-fg)"
          strokeWidth={i % 3 === 0 ? 3 : 2}
          strokeLinecap="round"
          transform={`rotate(${i * 30} 60 60)`}
        />
      ))}
      <g
        style={{
          transform: `rotate(${elapsed * 360}deg)`,
          transformOrigin: "60px 60px",
          transition: `transform ${SMOOTH}`,
        }}
      >
        <line
          x1="60"
          y1="64"
          x2="60"
          y2="22"
          stroke="var(--color-sticker)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <line
          x1="60"
          y1="64"
          x2="60"
          y2="22"
          stroke="var(--color-play)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <circle
        cx="60"
        cy="60"
        r="5"
        fill="var(--color-play)"
        stroke="var(--color-sticker)"
        strokeWidth="2.5"
      />
    </svg>
  );
}

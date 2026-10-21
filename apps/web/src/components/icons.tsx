// Iconos SVG propios (sin emojis ni símbolos Unicode: cada sistema los dibuja distinto). Los de trazo usan
// currentColor; los de color (modos de juego), los tokens de globals.css con borde de pegatina.
// Los iconos de categoría están aparte, en category-icon.tsx.

type IconProps = { size?: number; className?: string };

function Svg({
  size = 24,
  className,
  children,
  ...rest
}: IconProps & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Icono de trazo redondeado en currentColor. */
function Stroke({
  children,
  width = 2.6,
  ...props
}: IconProps & { children: React.ReactNode; width?: number }) {
  return (
    <Svg
      {...props}
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

// Trazo --------------------------------------------------------------------------------------------

export const ArrowLeftIcon = (p: IconProps) => (
  <Stroke {...p} width={2.8}>
    <path d="M19 12H5M11 5.5 4.5 12l6.5 6.5" />
  </Stroke>
);

export const CloseIcon = (p: IconProps) => (
  <Stroke {...p} width={2.8}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Stroke>
);

export const CheckIcon = (p: IconProps) => (
  <Stroke {...p} width={3}>
    <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
  </Stroke>
);

/** Bandera de reportar. */
export const FlagIcon = (p: IconProps) => (
  <Stroke {...p} width={2.4}>
    <path d="M5.5 21V3.5" />
    <path d="M5.5 4h12.5l-3 4.5 3 4.5H5.5z" fill="currentColor" />
  </Stroke>
);

/** Bandera blanca de rendirse. */
export const WhiteFlagIcon = (p: IconProps) => (
  <Stroke {...p} width={2.2}>
    <path d="M5 21V4" />
    <path
      d="M5 4.5c3-1.8 5.5 1.8 8.5 0s4.5-.5 5.5 0v8c-1-.5-2.5-1.8-5.5 0s-5.5-1.8-8.5 0z"
      fill="var(--color-fg)"
    />
  </Stroke>
);

/** Dos personas: amigos. */
export const FriendsIcon = (p: IconProps) => (
  <Stroke {...p} width={2.4}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    <path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.1.8 3.5 2.8 3.5 5.7" />
  </Stroke>
);

// Relleno (partículas de celebración) --------------------------------------------------------------

export const StarIcon = (p: IconProps) => (
  <Svg {...p} fill="currentColor">
    <path d="m12 2.5 2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.8z" />
  </Svg>
);

export const SparkleIcon = (p: IconProps) => (
  <Svg {...p} fill="currentColor">
    <path d="M12 2c.8 6 4 9.2 10 10-6 .8-9.2 4-10 10-.8-6-4-9.2-10-10 6-.8 9.2-4 10-10z" />
  </Svg>
);

// Modos de juego, a color --------------------------------------------------------------------------

/** Rayo: partida rápida (y aciertos rápidos). */
export const QuickIcon = (p: IconProps) => (
  <Svg {...p} stroke="var(--color-sticker)" strokeWidth="1.3" strokeLinejoin="round">
    <path d="M14 1.8 4.8 13.6h6l-1.4 8.6 9.8-12.4h-6.1z" fill="var(--color-play)" />
    <path
      d="m13.1 4.8-5.5 7.4"
      stroke="#fff"
      strokeOpacity="0.6"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </Svg>
);

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

/** Dos espadas cruzadas: duelo. */
export const DuelIcon = (p: IconProps) => (
  <Svg {...p} stroke="var(--color-sticker)" strokeWidth="1.1" strokeLinejoin="round">
    <Sword angle={-45} />
    <Sword angle={45} />
  </Svg>
);

/** Hoja de calendario con una estrella: reto diario. */
export const DailyIcon = (p: IconProps) => (
  <Svg {...p} stroke="var(--color-sticker)" strokeWidth="1.3" strokeLinejoin="round">
    <rect x="2.5" y="4" width="19" height="18" rx="3.5" fill="var(--color-surface-2)" />
    <path d="M2.5 10V7.5A3.5 3.5 0 0 1 6 4h12a3.5 3.5 0 0 1 3.5 3.5V10z" fill="var(--color-play)" />
    <path d="M8 2v4M16 2v4" strokeWidth="1.8" strokeLinecap="round" />
    <path
      d="m12 11.8 1.6 3.1 3.4.5-2.5 2.4.6 3.4-3.1-1.6-3.1 1.6.6-3.4-2.5-2.4 3.4-.5z"
      fill="var(--color-accent)"
    />
  </Svg>
);

/** Reloj con un rayo: duelo relámpago. */
export const LiveIcon = (p: IconProps) => (
  <Svg {...p} stroke="var(--color-sticker)" strokeWidth="1.3" strokeLinejoin="round">
    <circle cx="10.5" cy="13" r="8.8" fill="var(--color-surface-2)" />
    <path
      d="M10.5 13V7.6M10.5 13l3 1.8"
      stroke="var(--color-fg)"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path d="M19.6 1.6 13.7 9.8h3.6l-1.5 6.4 6.4-8.7h-3.7z" fill="var(--color-play)" />
  </Svg>
);

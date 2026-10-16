// Avatares provisionales (placeholder hasta tener arte definitivo).
// Las claves deben coincidir con `public.avatars.id`; el catálogo (cuáles existen y están activos) vive en la BD.

type Palette = { body: string; gills: string; bg: string };
type Accessory = "glasses" | "bow" | "cap";

const PALETTES = {
  pink: { body: "#F9A8C9", gills: "#E8628F", bg: "#FFE4EF" },
  gold: { body: "#F8D06B", gills: "#E0A21A", bg: "#FFF4D1" },
  mint: { body: "#8EE3C8", gills: "#2FB58C", bg: "#DDF8EE" },
  sky: { body: "#8CCBF5", gills: "#3B93D9", bg: "#DCEFFC" },
  lilac: { body: "#C9B3F5", gills: "#8C68E0", bg: "#EEE7FD" },
  coral: { body: "#FFAD94", gills: "#F06A47", bg: "#FFE6DE" },
} satisfies Record<string, Palette>;

const AVATARS: Record<string, { palette: Palette; accessory?: Accessory }> = {
  "axolotl-pink": { palette: PALETTES.pink },
  "axolotl-gold": { palette: PALETTES.gold },
  "axolotl-mint": { palette: PALETTES.mint },
  "axolotl-sky": { palette: PALETTES.sky },
  "axolotl-lilac": { palette: PALETTES.lilac },
  "axolotl-coral": { palette: PALETTES.coral },
  "axolotl-pink-glasses": { palette: PALETTES.pink, accessory: "glasses" },
  "axolotl-gold-bow": { palette: PALETTES.gold, accessory: "bow" },
  "axolotl-mint-cap": { palette: PALETTES.mint, accessory: "cap" },
  "axolotl-sky-glasses": { palette: PALETTES.sky, accessory: "glasses" },
  "axolotl-lilac-bow": { palette: PALETTES.lilac, accessory: "bow" },
  "axolotl-coral-cap": { palette: PALETTES.coral, accessory: "cap" },
};

const INK = "#2B2140";
const FALLBACK = AVATARS["axolotl-pink"]!;

// Tres "plumas" de branquias por lado: [x, y, rotación].
const GILLS: [number, number, number][] = [
  [24, 40, -35],
  [17, 52, -5],
  [22, 64, 25],
];

export function Avatar({
  id,
  size = 64,
  className,
}: {
  id: string;
  size?: number;
  className?: string;
}) {
  const { palette, accessory } = AVATARS[id] ?? FALLBACK;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <clipPath id="avatar-circle">
        <circle cx="50" cy="50" r="50" />
      </clipPath>
      <g clipPath="url(#avatar-circle)">
        <rect width="100" height="100" fill={palette.bg} />
        <ellipse cx="50" cy="100" rx="26" ry="18" fill={palette.body} />
        {GILLS.map(([x, y, r]) => (
          <g key={`${x}-${y}`} fill={palette.gills}>
            <ellipse cx={x} cy={y} rx="11" ry="4.5" transform={`rotate(${r} ${x} ${y})`} />
            <ellipse
              cx={100 - x}
              cy={y}
              rx="11"
              ry="4.5"
              transform={`rotate(${-r} ${100 - x} ${y})`}
            />
          </g>
        ))}
        <ellipse cx="50" cy="56" rx="29" ry="24" fill={palette.body} />
        <ellipse cx="33" cy="64" rx="5" ry="3" fill={palette.gills} opacity="0.35" />
        <ellipse cx="67" cy="64" rx="5" ry="3" fill={palette.gills} opacity="0.35" />
        <circle cx="39" cy="54" r="4" fill={INK} />
        <circle cx="61" cy="54" r="4" fill={INK} />
        <circle cx="40.3" cy="52.7" r="1.3" fill="#fff" />
        <circle cx="62.3" cy="52.7" r="1.3" fill="#fff" />
        <path
          d="M43 64 Q50 70 57 64"
          fill="none"
          stroke={INK}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {accessory === "glasses" && (
          <g fill="none" stroke={INK} strokeWidth="2">
            <circle cx="39" cy="54" r="7.5" />
            <circle cx="61" cy="54" r="7.5" />
            <path d="M46.5 54 H53.5" />
          </g>
        )}
        {accessory === "bow" && (
          <g fill={palette.gills} stroke={INK} strokeWidth="1.5" strokeLinejoin="round">
            <path d="M50 33 L39 26 L39 40 Z" />
            <path d="M50 33 L61 26 L61 40 Z" />
            <circle cx="50" cy="33" r="3.5" />
          </g>
        )}
        {accessory === "cap" && (
          <g fill={palette.gills} stroke={INK} strokeWidth="1.5" strokeLinejoin="round">
            <path d="M28 41 Q30 22 50 21 Q70 22 72 41 Z" />
            <path d="M66 39 Q78 37 84 42 Q74 45 66 43 Z" />
          </g>
        )}
      </g>
    </svg>
  );
}

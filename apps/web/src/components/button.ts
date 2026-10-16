// Clases de botón compartidas por <button> y <Link>.
const VARIANTS = {
  primary: "bg-accent text-accent-ink",
  secondary: "bg-surface-2 text-fg",
  play: "bg-play text-ink px-8 py-3.5 text-2xl",
  danger: "bg-ko text-white",
} as const;

export function buttonClassName(variant: keyof typeof VARIANTS = "primary", extra = "") {
  return `sticker inline-flex items-center justify-center rounded-2xl px-5 py-3 font-display text-lg font-bold transition-[transform,box-shadow] duration-75 active:translate-y-1 active:shadow-sticker-pressed disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${extra}`;
}

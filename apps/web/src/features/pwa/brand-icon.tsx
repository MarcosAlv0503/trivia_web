import { ImageResponse } from "next/og";
import { Mascot } from "@/components/mascot";

// Iconos del navegador y de la app instalada, dibujados desde la mascota: cambian con ella.
// La mascota ocupa el 60 % central, así el mismo icono sirve como "maskable" (Android lo recorta en círculo).
export const BRAND_BG = "#0b2735"; // = --color-bg en globals.css (ImageResponse no lee variables CSS)
export const ICON_SIZES = [192, 512] as const;

export function brandIcon(size: number) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_BG,
      }}
    >
      {/* El dibujo de la mascota está en la parte baja de su viewBox: se sube para centrarlo. */}
      <div style={{ display: "flex", marginTop: -Math.round(size * 0.1) }}>
        <Mascot size={Math.round(size * 0.6)} />
      </div>
    </div>,
    { width: size, height: size },
  );
}

import { ImageResponse } from "next/og";
import { CategoryIcon } from "@/components/category-icon";
import { Mascot } from "@/components/mascot";
import { BRAND_BG } from "@/features/pwa/brand-icon";
import type { DailyRound } from "./types";

// = tokens de globals.css (ImageResponse no lee variables CSS).
const FG = "#eaf7f7";
const FG_MUTED = "#9cc3c9";
const BG_DEEP = "#071b26";
const INK = "#2b2140";
const STICKER = "#01080c";

const SIZE = 1080;
const SQUARE = 118;

/** Imagen cuadrada para compartir el resultado del reto: ajolote, título, cuadritos y aciertos/puntos (ya traducidos). */
export function dailyImage({
  title,
  result,
  rounds,
}: {
  title: string;
  result: string;
  rounds: DailyRound[];
}) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 48,
        background: BRAND_BG,
        color: FG,
      }}
    >
      <Mascot size={300} />
      <div style={{ display: "flex", fontSize: 88, fontWeight: 700 }}>{title}</div>
      <div style={{ display: "flex", gap: 16 }}>
        {rounds.map((round, i) => (
          <div
            key={i}
            style={{
              width: SQUARE,
              height: SQUARE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 24,
              border: `8px solid ${round.correct ? STICKER : round.color}`,
              background: round.correct ? round.color : BG_DEEP,
              color: round.correct ? INK : FG_MUTED,
            }}
          >
            <CategoryIcon id={round.categoryId} size={64} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: FG_MUTED }}>
        {result}
      </div>
    </div>,
    // Sin caché: es el resultado de quien lo pide.
    { width: SIZE, height: SIZE, headers: { "Cache-Control": "private, no-store" } },
  );
}

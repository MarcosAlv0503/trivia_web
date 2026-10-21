import { useTranslations } from "next-intl";
import { CategoryIcon } from "@/components/category-icon";
import type { DailyRound } from "./types";

/** Resultado del reto en cuadritos: acierto relleno del color de la categoría; fallo apagado con el borde del color. */
export function DailySquares({ rounds, size = 40 }: { rounds: DailyRound[]; size?: number }) {
  const t = useTranslations("Daily");
  return (
    <ol className="flex gap-1.5">
      {rounds.map((round, i) => (
        <li
          key={i}
          className={`grid shrink-0 place-items-center rounded-lg border-2 ${
            round.correct ? "border-sticker text-ink" : "bg-bg-deep text-fg-muted"
          }`}
          style={{
            width: size,
            height: size,
            ...(round.correct ? { backgroundColor: round.color } : { borderColor: round.color }),
          }}
        >
          <CategoryIcon
            id={round.categoryId}
            size={Math.round(size * 0.55)}
            className={round.correct ? undefined : "opacity-60"}
          />
          <span className="sr-only">
            {t(round.correct ? "squareHit" : "squareMiss", { category: round.name })}
          </span>
        </li>
      ))}
    </ol>
  );
}

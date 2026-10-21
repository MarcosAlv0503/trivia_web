import { useTranslations } from "next-intl";
import { categoryHighlights } from "@trivia/game-core";
import { CategoryIcon } from "@/components/category-icon";

export type CategoryStat = {
  id: string;
  name: string;
  color: string;
  answered: number;
  correct: number;
};

const percent = (correct: number, answered: number) => Math.round((100 * correct) / answered);

/** Respondidas y % de acierto del jugador, en total y por categoría (con su mejor y su peor), en el perfil. */
export function CategoryStats({ stats }: { stats: CategoryStat[] }) {
  const t = useTranslations("Stats");
  const answered = stats.reduce((sum, s) => sum + s.answered, 0);
  const correct = stats.reduce((sum, s) => sum + s.correct, 0);
  const { best, worst } = categoryHighlights(stats);

  return (
    <section className="flex w-full flex-col gap-4 rounded-card bg-surface p-4 sticker">
      <div className="flex flex-col">
        <h2 className="text-xl font-bold">{t("title")}</h2>
        <span className="font-bold text-fg-muted tabular-nums">
          {t("totalAnswered", { count: answered })}
          {answered > 0 && ` · ${t("totalHitRate", { rate: percent(correct, answered) })}`}
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {stats.map((s) => {
          const rate = s.answered > 0 ? percent(s.correct, s.answered) : 0;
          return (
            <li key={s.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 font-bold">
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-sticker text-ink"
                  style={{ backgroundColor: s.color }}
                >
                  <CategoryIcon id={s.id} size={16} />
                </span>
                <span className="min-w-0 truncate">{s.name}</span>
                {s.id === best && (
                  <span className="shrink-0 rounded-full border-2 border-sticker bg-ok px-2 text-xs font-extrabold text-ink">
                    {t("best")}
                  </span>
                )}
                {s.id === worst && (
                  <span className="shrink-0 rounded-full border-2 border-sticker bg-ko px-2 text-xs font-extrabold text-white">
                    {t("worst")}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-fg-muted tabular-nums">
                  {s.answered > 0 ? t("rate", { rate }) : t("notPlayed")}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={t("barLabel", { category: s.name, count: s.answered })}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={rate}
                className="h-3 w-full overflow-hidden rounded-full border-2 border-sticker bg-bg-deep"
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${rate}%`, backgroundColor: s.color }}
                />
              </div>
              {s.answered > 0 && (
                <span className="text-sm font-bold text-fg-muted tabular-nums">
                  {t("answered", { count: s.answered })}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

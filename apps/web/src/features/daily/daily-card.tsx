import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/components/button";
import { DailyIcon } from "@/components/icons";
import { startDaily } from "./actions";
import { DailySquares } from "./daily-squares";
import type { Daily } from "./types";

/** Tarjeta del reto de hoy en la portada: jugar / continuar, o tus cuadritos si ya lo has terminado. */
export function DailyCard({ daily }: { daily: Daily }) {
  const t = useTranslations("Daily");
  const { match } = daily;
  return (
    <section className="flex w-full flex-col gap-3 rounded-card bg-surface p-5 sticker">
      <h2 className="flex items-center gap-2 text-2xl font-bold">
        <DailyIcon size={30} />
        {t("title", { number: daily.number })}
      </h2>
      {match?.finished ? (
        <>
          <DailySquares rounds={match.rounds} size={36} />
          <p className="font-bold text-fg-muted">
            {t("result", {
              correct: match.correct,
              total: match.rounds.length,
              points: match.score,
            })}
          </p>
          <Link href="/daily" className={buttonClassName("secondary", "self-end")}>
            {t("seeResult")}
          </Link>
        </>
      ) : (
        <>
          <p className="font-bold text-fg-muted">
            {t("summary")}
            <br />
            {t("tagline")}
          </p>
          <form action={startDaily} className="self-end">
            <button type="submit" className={buttonClassName("play")}>
              {match ? t("continue") : t("play")}
            </button>
          </form>
        </>
      )}
    </section>
  );
}

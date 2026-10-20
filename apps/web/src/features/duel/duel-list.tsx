import Link from "next/link";
import { useTranslations } from "next-intl";
import { Avatar } from "@/features/profile/avatar";
import { LevelBadge } from "@/features/progress/level-badge";
import type { DuelSummary } from "./types";

const RESULT_KEYS = {
  win: "listWin",
  loss: "listLoss",
  draw: "listDraw",
  cancelled: "listCancelled",
} as const;

/** Duelos del usuario tal como los ordena el servidor: primero los que le tocan. */
export function DuelList({ duels }: { duels: DuelSummary[] }) {
  const t = useTranslations("Duel");
  const tHome = useTranslations("Home");

  if (duels.length === 0) return <p className="text-fg-muted">{tHome("noDuels")}</p>;

  return (
    <ul className="grid gap-2">
      {duels.map((duel) => {
        const myTurn = duel.nextAction === "spin" || duel.nextAction === "answer";
        return (
          <li key={duel.id}>
            <Link
              href={`/duel/${duel.id}`}
              className={`flex items-center gap-3 rounded-2xl p-2 pr-4 sticker ${
                myTurn ? "bg-surface-2 ring-4 ring-accent" : "bg-surface"
              }`}
            >
              <Avatar id={duel.opponent.avatarId} size={40} />
              <span className="min-w-0 truncate font-display text-lg font-bold">
                {duel.opponent.username}
              </span>
              <LevelBadge xp={duel.opponent.xp} />
              {duel.status === "active" ? (
                <>
                  <span className="ml-auto text-sm font-bold text-fg-muted">
                    {duel.round}/{duel.roundCount}
                  </span>
                  {myTurn ? (
                    <span className="rounded-full bg-accent px-3 py-0.5 text-sm font-extrabold text-accent-ink">
                      {t("yourTurn")}
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-fg-muted">{t("waitingShort")}</span>
                  )}
                </>
              ) : (
                duel.result && (
                  <span
                    className={`ml-auto text-sm font-bold ${
                      duel.result === "win"
                        ? "text-ok"
                        : duel.result === "loss"
                          ? "text-ko"
                          : "text-fg-muted"
                    }`}
                  >
                    {t(RESULT_KEYS[duel.result], { me: duel.myScore, them: duel.opponentScore })}
                  </span>
                )
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

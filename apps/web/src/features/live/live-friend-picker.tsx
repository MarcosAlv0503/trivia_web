"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/components/button";
import type { Friend } from "@/features/friends/types";
import { Avatar } from "@/features/profile/avatar";
import { LevelBadge } from "@/features/progress/level-badge";
import { LiveChallenge } from "./live-challenge";
import { PresenceDot } from "./presence-dot";

// Al ritmo del latido de presencia: quien se conecta o termina una partida aparece solo.
const REFRESH_MS = 20_000;

/** Amigos conectados, para retarlos en vivo. Los que están jugando se ven pero no se pueden retar. */
export function LiveFriendPicker({ friends }: { friends: Friend[] }) {
  const t = useTranslations("Live");
  const router = useRouter();
  const [picked, setPicked] = useState<string>();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  if (friends.length === 0) {
    return (
      <div className="flex w-full max-w-md flex-col gap-3 text-center">
        <p className="font-bold">{t("noneOnline")}</p>
        <p className="text-fg-muted">{t("hiddenHint")}</p>
        <Link href="/friends" className={buttonClassName("secondary", "self-center")}>
          {t("friends")}
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex w-full max-w-md flex-col gap-2">
      {friends.map((friend) => (
        <li key={friend.id} className="flex flex-col gap-3 rounded-2xl bg-surface p-2 sticker">
          <div className="flex items-center gap-3 pr-1">
            <Avatar id={friend.avatarId} size={44} className="shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-display text-lg font-bold">{friend.username}</span>
                <LevelBadge xp={friend.xp} />
              </span>
              <PresenceDot presence={friend.presence} />
            </div>
            {friend.presence === "online" && picked !== friend.id && (
              <button
                type="button"
                onClick={() => setPicked(friend.id)}
                className={buttonClassName("primary", "shrink-0 px-4 py-2 text-base")}
              >
                {t("challenge")}
              </button>
            )}
          </div>
          {picked === friend.id && (
            <LiveChallenge friend={friend} onCancel={() => setPicked(undefined)} />
          )}
        </li>
      ))}
    </ul>
  );
}

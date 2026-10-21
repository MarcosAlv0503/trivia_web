import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { levelProgress, LIVE, QUICK } from "@trivia/game-core";
import { buttonClassName } from "@/components/button";
import { LoginButtons } from "@/features/auth/login-buttons";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { DuelList } from "@/features/duel/duel-list";
import type { DuelSummary } from "@/features/duel/types";
import { DailyCard } from "@/features/daily/daily-card";
import type { Daily } from "@/features/daily/types";
import type { FriendLists } from "@/features/friends/types";
import { HomeIntro } from "@/features/home/home-intro";
import { LegalLinks } from "@/features/legal/legal-links";
import { Avatar } from "@/features/profile/avatar";
import { getAuthContext, getOwnProfile } from "@/features/profile/queries";
import { DuelIcon, FriendsIcon, LiveIcon, QuickIcon } from "@/components/icons";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { claims } = await getAuthContext();

  if (!claims) {
    const t = await getTranslations("Auth");
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
        <HomeIntro />
        {(await searchParams).error === "auth" && (
          <p role="alert" className="font-bold text-ko">
            {t("error")}
          </p>
        )}
        <LoginButtons />
        <LegalLinks />
      </main>
    );
  }

  const profile = await getOwnProfile();
  if (!profile) redirect("/onboarding");
  const { supabase } = await getAuthContext();
  const [t, tProgress, tQuick, tDuel, tLive, { data: duels }, { data: friends }, { data: daily }] =
    await Promise.all([
      getTranslations("Home"),
      getTranslations("Progress"),
      getTranslations("Quick"),
      getTranslations("Duel"),
      getTranslations("Live"),
      supabase.rpc("list_duels"),
      supabase.rpc("list_friends"),
      supabase.rpc("get_daily"),
    ]);
  const incoming = (friends as unknown as FriendLists | null)?.incoming.length ?? 0;
  const { level } = levelProgress(profile.xp);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-8 p-6">
      <div className="flex w-full items-center justify-between gap-3">
        <Link
          href="/friends"
          className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 font-display font-bold sticker"
        >
          <FriendsIcon size={20} />
          {t("friends")}
          {incoming > 0 && (
            <span className="grid min-w-6 place-items-center rounded-full bg-accent px-1.5 text-sm text-accent-ink">
              {incoming}
            </span>
          )}
        </Link>
        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-full bg-surface py-1 pr-4 pl-1 sticker"
          aria-label={t("profileLink")}
        >
          <Avatar id={profile.avatar_id} size={36} />
          <span className="flex flex-col leading-tight">
            <span className="font-display font-bold">{profile.username}</span>
            <span className="text-sm font-bold text-fg-muted">{tProgress("level", { level })}</span>
          </span>
        </Link>
      </div>
      <HomeIntro />

      {/* Una tarjeta por modo de juego; el reto diario primero. Sin reto (p. ej. sin preguntas suficientes), sin tarjeta. */}
      {daily && <DailyCard daily={daily as unknown as Daily} />}
      <section className="flex w-full flex-col gap-3 rounded-card bg-surface p-5 sticker">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <QuickIcon size={30} />
          {tQuick("title")}
        </h2>
        <p className="font-bold text-fg-muted">
          {tQuick("summary", {
            questions: QUICK.questionsPerPlayer,
            seconds: QUICK.secondsPerQuestion,
          })}
          <br />
          {tQuick("tagline")}
        </p>
        <Link href="/play/quick" className={buttonClassName("play", "self-end")}>
          {tQuick("play")}
        </Link>
      </section>

      <section className="flex w-full flex-col gap-3 rounded-card bg-surface p-5 sticker">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <DuelIcon size={30} />
          {tDuel("title")}
        </h2>
        <p className="font-bold text-fg-muted">
          {tDuel("summary")}
          <br />
          {tDuel("tagline")}
        </p>
        <Link href="/friends" className={buttonClassName("play", "self-end text-xl")}>
          {tDuel("challengeFriend")}
        </Link>
      </section>

      <section className="flex w-full flex-col gap-3 rounded-card bg-surface p-5 sticker">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <LiveIcon size={30} />
          {tLive("title")}
        </h2>
        <p className="font-bold text-fg-muted">
          {tLive("summary", { seconds: LIVE.matchMs / 1000 })}
          <br />
          {tLive("tagline")}
        </p>
        <Link href="/live" className={buttonClassName("play", "self-end text-xl")}>
          {tLive("play")}
        </Link>
      </section>

      <section className="flex w-full flex-col gap-2">
        <h2 className="text-xl font-bold">{t("duelsTitle")}</h2>
        <DuelList duels={(duels as unknown as DuelSummary[] | null) ?? []} />
      </section>

      <SignOutButton />
    </main>
  );
}

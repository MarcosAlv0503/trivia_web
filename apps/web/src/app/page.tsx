import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { QUICK } from "@trivia/game-core";
import { buttonClassName } from "@/components/button";
import { LoginButtons } from "@/features/auth/login-buttons";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { HomeIntro } from "@/features/home/home-intro";
import { Avatar } from "@/features/profile/avatar";
import { getAuthContext, getOwnProfile } from "@/features/profile/queries";

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
      </main>
    );
  }

  const profile = await getOwnProfile();
  if (!profile) redirect("/onboarding");
  const [t, tQuick] = await Promise.all([getTranslations("Home"), getTranslations("Quick")]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-8 p-6">
      <Link
        href="/profile"
        className="flex items-center gap-2 self-end rounded-full bg-surface py-1 pr-4 pl-1 sticker"
        aria-label={t("profileLink")}
      >
        <Avatar id={profile.avatar_id} size={36} />
        <span className="font-display font-bold">{profile.username}</span>
      </Link>
      <HomeIntro />

      {/* Una tarjeta por modo de juego. */}
      <section className="flex w-full flex-col gap-3 rounded-card bg-surface p-5 sticker">
        <h2 className="text-2xl font-bold">⚡ {tQuick("title")}</h2>
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

      <SignOutButton />
    </main>
  );
}

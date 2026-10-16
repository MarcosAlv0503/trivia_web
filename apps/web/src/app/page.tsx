import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("Home");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <HomeIntro />
      <Link
        href="/profile"
        className="flex items-center gap-3 rounded-full bg-surface py-1.5 pr-5 pl-1.5 sticker"
        aria-label={t("profileLink")}
      >
        <Avatar id={profile.avatar_id} size={48} />
        <span className="font-display text-xl font-bold">{profile.username}</span>
      </Link>
      <SignOutButton />
    </main>
  );
}

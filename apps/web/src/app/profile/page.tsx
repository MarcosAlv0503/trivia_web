import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { DeleteAccount } from "@/features/profile/delete-account";
import { ProfileForm } from "@/features/profile/profile-form";
import { getActiveAvatarIds, getAuthContext, requireProfile } from "@/features/profile/queries";
import { LegalLinks } from "@/features/legal/legal-links";
import { DevicePreferences } from "@/features/preferences/device-preferences";
import { LevelCard } from "@/features/progress/level-card";
import { CategoryStats, type CategoryStat } from "@/features/stats/category-stats";
import { OnlineToggle } from "@/features/presence/online-toggle";
import { PushToggle } from "@/features/pwa/push-toggle";

export default async function ProfilePage() {
  const profile = await requireProfile();
  const { supabase, claims } = await getAuthContext();
  const [t, avatarIds, { data: isAdmin }, { data: stats }] = await Promise.all([
    getTranslations("Profile"),
    getActiveAvatarIds(),
    supabase.rpc("is_admin"),
    supabase.rpc("category_stats"),
  ]);

  return (
    <main className="flex min-h-dvh flex-col items-center gap-8 p-6">
      <div className="flex w-full max-w-md items-center gap-3">
        <BackLink href="/" label={t("back")} />
        <h1 className="text-3xl font-bold">{t("editTitle")}</h1>
      </div>
      <div className="flex w-full max-w-md flex-col gap-4">
        <LevelCard xp={profile.xp} />
        {stats && <CategoryStats stats={stats as unknown as CategoryStat[]} />}
      </div>
      <ProfileForm
        mode="edit"
        avatarIds={avatarIds}
        initial={{
          username: profile.username,
          avatarId: profile.avatar_id,
          locale: profile.locale,
        }}
      />
      <DevicePreferences />
      <PushToggle />
      <OnlineToggle userId={claims!.sub} initial={profile.show_online} />
      <DeleteAccount />
      <LegalLinks />
      {isAdmin && (
        <Link href="/admin" className="font-bold text-fg-muted underline">
          {t("adminLink")}
        </Link>
      )}
    </main>
  );
}

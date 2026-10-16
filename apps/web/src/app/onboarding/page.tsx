import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/features/profile/profile-form";
import { getActiveAvatarIds, getOwnProfile, suggestUsername } from "@/features/profile/queries";

export default async function OnboardingPage() {
  if (await getOwnProfile()) redirect("/");

  const [t, avatarIds, username] = await Promise.all([
    getTranslations("Profile"),
    getActiveAvatarIds(),
    suggestUsername(),
  ]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">{t("onboardingTitle")}</h1>
        <p className="mt-1">{t("onboardingSubtitle")}</p>
      </div>
      <ProfileForm
        mode="create"
        avatarIds={avatarIds}
        initial={{ username, avatarId: avatarIds[0] ?? "" }}
      />
    </main>
  );
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonClassName } from "@/components/button";
import { DeleteAccount } from "@/features/profile/delete-account";
import { ProfileForm } from "@/features/profile/profile-form";
import { getActiveAvatarIds, requireProfile } from "@/features/profile/queries";

export default async function ProfilePage() {
  const profile = await requireProfile();
  const [t, avatarIds] = await Promise.all([getTranslations("Profile"), getActiveAvatarIds()]);

  return (
    <main className="flex min-h-dvh flex-col items-center gap-8 p-6">
      <div className="flex w-full max-w-md items-center justify-between">
        <h1 className="text-3xl font-bold">{t("editTitle")}</h1>
        <Link href="/" className={buttonClassName("secondary")}>
          {t("back")}
        </Link>
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
      <DeleteAccount />
    </main>
  );
}

import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { SetupForm } from "@/features/game/quick/setup-form";
import { getActiveAvatarIds, getAuthContext, requireProfile } from "@/features/profile/queries";

export default async function QuickSetupPage() {
  const profile = await requireProfile();
  const { supabase } = await getAuthContext();
  const [t, avatarIds, { data: guests }] = await Promise.all([
    getTranslations("Quick"),
    getActiveAvatarIds(),
    supabase.from("guests").select("name, avatar_id").order("last_used_at", { ascending: false }),
  ]);

  return (
    <main className="flex min-h-dvh flex-col items-center gap-8 p-6">
      <div className="flex w-full max-w-md items-center gap-3">
        <BackLink href="/" label={t("back")} />
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>
      <SetupForm
        host={{ username: profile.username, avatarId: profile.avatar_id }}
        recentGuests={(guests ?? []).map((g) => ({ name: g.name, avatarId: g.avatar_id }))}
        avatarIds={avatarIds}
      />
    </main>
  );
}

import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import type { FriendLists } from "@/features/friends/types";
import { LiveFriendPicker } from "@/features/live/live-friend-picker";
import { getAuthContext, requireProfile } from "@/features/profile/queries";

export default async function LivePage() {
  await requireProfile();
  const { supabase } = await getAuthContext();
  const [t, { data }] = await Promise.all([getTranslations("Live"), supabase.rpc("list_friends")]);
  const friends = ((data as unknown as FriendLists | null)?.friends ?? []).filter(
    (f) => f.presence !== "offline",
  );

  return (
    <main className="flex min-h-dvh flex-col items-center gap-8 p-6">
      <div className="flex w-full max-w-md items-center gap-3">
        <BackLink href="/" label={t("back")} />
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>
      <p className="w-full max-w-md font-bold text-fg-muted">{t("pickTitle")}</p>
      <LiveFriendPicker friends={friends} />
    </main>
  );
}

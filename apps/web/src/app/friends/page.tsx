import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { FriendsView } from "@/features/friends/friends-view";
import type { FriendLists } from "@/features/friends/types";
import { getAuthContext, requireProfile } from "@/features/profile/queries";

export default async function FriendsPage() {
  await requireProfile();
  const { supabase } = await getAuthContext();
  const [t, { data }] = await Promise.all([
    getTranslations("Friends"),
    supabase.rpc("list_friends"),
  ]);
  const lists = (data as unknown as FriendLists | null) ?? {
    friends: [],
    incoming: [],
    outgoing: [],
  };

  return (
    <main className="flex min-h-dvh flex-col items-center gap-8 p-6">
      <div className="flex w-full max-w-md items-center gap-3">
        <BackLink href="/" label={t("back")} />
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>
      <FriendsView lists={lists} />
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buttonClassName } from "@/components/button";
import { ReviewQueue, type QueueItem } from "@/features/admin/review-queue";
import { getAuthContext, requireProfile } from "@/features/profile/queries";

// Panel de revisión de preguntas. Para quien no es admin no existe (las RPC lo vuelven a comprobar).
export default async function AdminPage() {
  await requireProfile();
  const { supabase } = await getAuthContext();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) notFound();

  const [t, { data }] = await Promise.all([
    getTranslations("Admin"),
    supabase.rpc("admin_review_queue"),
  ]);
  const items = (data as unknown as QueueItem[] | null) ?? [];

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 p-4 sm:p-6">
      <div className="flex w-full max-w-2xl items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Link href="/profile" className={buttonClassName("secondary")}>
          {t("back")}
        </Link>
      </div>
      <p className="w-full max-w-2xl font-bold text-fg-muted">
        {t("summary", { count: items.length })}
      </p>
      <ReviewQueue items={items} />
    </main>
  );
}

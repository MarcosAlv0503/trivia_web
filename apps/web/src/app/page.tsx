import { LoginButtons } from "@/features/auth/login-buttons";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { HomeIntro } from "@/features/home/home-intro";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const t = await getTranslations("Auth");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <HomeIntro />
      {data?.claims ? (
        <SignOutButton />
      ) : (
        <>
          {(await searchParams).error === "auth" && (
            <p role="alert" className="text-red-600">
              {t("error")}
            </p>
          )}
          <LoginButtons />
        </>
      )}
    </main>
  );
}

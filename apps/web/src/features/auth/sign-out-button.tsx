"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/components/button";
import { disablePush } from "@/features/pwa/push";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "./actions";

export function SignOutButton() {
  const t = useTranslations("Auth");
  const [supabase] = useState(createClient);
  return (
    <form
      action={async () => {
        // Sin sesión, este dispositivo deja de recibir los avisos de la cuenta.
        await disablePush(supabase).catch(() => {});
        await signOut();
      }}
    >
      <button type="submit" className={buttonClassName("secondary")}>
        {t("signOut")}
      </button>
    </form>
  );
}

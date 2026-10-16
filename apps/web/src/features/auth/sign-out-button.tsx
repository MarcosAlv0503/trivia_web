import { useTranslations } from "next-intl";
import { buttonClassName } from "@/components/button";
import { signOut } from "./actions";

export function SignOutButton() {
  const t = useTranslations("Auth");
  return (
    <form action={signOut}>
      <button type="submit" className={buttonClassName("secondary")}>
        {t("signOut")}
      </button>
    </form>
  );
}

import { useTranslations } from "next-intl";
import { signOut } from "./actions";

export function SignOutButton() {
  const t = useTranslations("Auth");
  return (
    <form action={signOut}>
      <button type="submit" className="rounded-xl border px-4 py-2">
        {t("signOut")}
      </button>
    </form>
  );
}

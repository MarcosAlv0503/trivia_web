import Link from "next/link";
import { useTranslations } from "next-intl";

export function LegalLinks() {
  const t = useTranslations("Legal");
  return (
    <nav className="flex gap-4 text-sm font-bold text-fg-muted underline">
      <Link href="/legal/terms">{t("terms")}</Link>
      <Link href="/legal/privacy">{t("privacy")}</Link>
    </nav>
  );
}

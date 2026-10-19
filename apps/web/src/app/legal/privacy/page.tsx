import { LegalPage, legalMetadata } from "@/features/legal/legal-page";

export const generateMetadata = () => legalMetadata("privacy");

export default function PrivacyPage() {
  return <LegalPage kind="privacy" />;
}

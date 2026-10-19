import { LegalPage, legalMetadata } from "@/features/legal/legal-page";

export const generateMetadata = () => legalMetadata("terms");

export default function TermsPage() {
  return <LegalPage kind="terms" />;
}

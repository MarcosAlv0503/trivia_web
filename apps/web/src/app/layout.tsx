import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { NotificationToasts } from "@/features/notifications/notification-toasts";
import { getAuthContext } from "@/features/profile/queries";
import { BRAND_BG } from "@/features/pwa/brand-icon";
import { RegisterServiceWorker } from "@/features/pwa/register-service-worker";
import "./globals.css";

// next/font descarga las fuentes al compilar y las sirve desde nuestro dominio (sin peticiones a Google).
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: t("title"),
    description: t("description"),
    // iOS: abrir a pantalla completa al instalarla en la pantalla de inicio (requisito de los avisos push).
    appleWebApp: { capable: true, title: t("title") },
  };
}

export const viewport: Viewport = { themeColor: BRAND_BG };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, { claims }] = await Promise.all([getLocale(), getAuthContext()]);
  return (
    <html lang={locale} className={`${fredoka.variable} ${nunito.variable}`}>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          {children}
          {claims && <NotificationToasts userId={claims.sub} />}
          <RegisterServiceWorker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

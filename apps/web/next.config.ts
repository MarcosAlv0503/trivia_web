import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@trivia/game-core"],
};

// Sube los source maps a Sentry al compilar si hay SENTRY_AUTH_TOKEN, SENTRY_ORG y SENTRY_PROJECT (en Vercel).
export default withSentryConfig(withNextIntl(nextConfig), {
  // Los errores salen por nuestro dominio: los bloqueadores de anuncios cortan las peticiones directas a Sentry.
  // Nombre neutro (las listas de bloqueo incluyen rutas como /monitoring); excluido del proxy en src/proxy.ts.
  tunnelRoute: "/lagoon",
  silent: !process.env.CI,
  telemetry: false,
});

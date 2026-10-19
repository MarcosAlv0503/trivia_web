import * as Sentry from "@sentry/nextjs";

// Errores del navegador a Sentry. Sin DSN (en local) no se envía nada.
// Solo errores: sin trazas, sin grabación de sesión y sin datos personales.
Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });

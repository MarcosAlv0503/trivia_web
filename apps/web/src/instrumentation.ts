import * as Sentry from "@sentry/nextjs";

// Errores del servidor a Sentry. Sin DSN (en local) no se envía nada.
// Solo errores: sin trazas de rendimiento y sin datos personales (`sendDefaultPii` queda en false).
export function register() {
  Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });
}

export const onRequestError = Sentry.captureRequestError;

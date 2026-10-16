export const locales = ["es", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "es";

// Cada idioma se muestra en su propia lengua (endónimo), por eso no pasa por las traducciones.
export const LOCALE_NAMES: Record<Locale, string> = { es: "Español", en: "English" };

// Cookie estándar de next-intl; se fija desde el idioma del perfil (login y edición del perfil).
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
} as const;

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

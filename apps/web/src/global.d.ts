import type messages from "../messages/es.json";
import type { Locale } from "./i18n/config";

// Tipado estricto de claves de traducción: `es.json` es la fuente de verdad.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}

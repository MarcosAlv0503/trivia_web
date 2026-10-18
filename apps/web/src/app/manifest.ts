import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";
import { BRAND_BG, ICON_SIZES } from "@/features/pwa/brand-icon";

// Manifiesto de la PWA (app instalable). Nombre y descripción en el idioma de quien la instala.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("Metadata");
  return {
    name: t("title"),
    short_name: t("title"),
    description: t("description"),
    start_url: "/",
    display: "standalone",
    background_color: BRAND_BG,
    theme_color: BRAND_BG,
    icons: ICON_SIZES.flatMap((size) =>
      (["any", "maskable"] as const).map((purpose) => ({
        src: `/icon/${size}`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose,
      })),
    ),
  };
}

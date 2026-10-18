import { defaultLocale, locales } from "@/i18n/config";

// Service worker de la PWA: muestra los avisos push. Se genera aquí para que sus textos salgan de messages/*.json.
// No intercepta peticiones (sin caché offline): solo sirve para instalar la app y recibir avisos.
export const dynamic = "force-static";

export async function GET() {
  const texts = Object.fromEntries(
    await Promise.all(
      locales.map(async (locale) => {
        const messages = (await import(`../../../messages/${locale}.json`)).default;
        return [locale, { title: messages.Metadata.title, ...messages.Notifications }];
      }),
    ),
  );

  // Carga del aviso (supabase/functions/push): { kind, actorName, duelId, locale }.
  const source = `
const TEXTS = ${JSON.stringify(texts)};

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const t = TEXTS[data.locale] || TEXTS[${JSON.stringify(defaultLocale)}];
  // Los textos de aviso solo usan el marcador {name}.
  const body = (t[data.kind] || "").replace("{name}", data.actorName || "");
  event.waitUntil(
    self.registration.showNotification(t.title, {
      body,
      icon: "/icon/192",
      tag: data.duelId || data.kind,
      data: { url: data.duelId ? "/duel/" + data.duelId : "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data.url, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url === url);
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});
`;

  return new Response(source, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

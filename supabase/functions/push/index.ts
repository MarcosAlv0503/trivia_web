// Envía los avisos push web de una notificación. La llama el trigger `notifications_send_push` (vía pg_net)
// con el secreto compartido; el texto lo pone el service worker de la web (apps/web/src/app/sw.js) en el idioma
// del jugador.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
};

const secret = env("PUSH_WEBHOOK_SECRET");
webpush.setVapidDetails(env("VAPID_SUBJECT"), env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const { userId, kind, actorName, duelId, locale } = await req.json();

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) return new Response(error.message, { status: 500 });

  const payload = JSON.stringify({ kind, actorName, duelId, locale });
  const results = await Promise.allSettled(
    subscriptions.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 60 * 60 * 24 },
      ),
    ),
  );

  // 404/410: el navegador anuló la suscripción (permiso retirado, app desinstalada...).
  const gone = subscriptions
    .filter((_, i) => {
      const result = results[i]!;
      return result.status === "rejected" && [404, 410].includes(result.reason?.statusCode);
    })
    .map((s) => s.endpoint);
  if (gone.length) await supabase.from("push_subscriptions").delete().in("endpoint", gone);

  return Response.json({
    sent: results.filter((r) => r.status === "fulfilled").length,
    removed: gone.length,
  });
});

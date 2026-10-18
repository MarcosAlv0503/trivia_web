import type { createClient } from "@/lib/supabase/client";

type Client = ReturnType<typeof createClient>;

/** Clave pública VAPID; sin ella (entorno sin configurar) no se ofrecen avisos push. */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function currentPushSubscription() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Guarda en la cuenta actual la suscripción de este dispositivo. */
export async function savePushSubscription(supabase: Client, subscription: PushSubscription) {
  const { endpoint, keys } = subscription.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", {
    sub_endpoint: endpoint!,
    sub_p256dh: keys!.p256dh!,
    sub_auth: keys!.auth!,
  });
  return !error;
}

/** Pide permiso y suscribe este dispositivo. Devuelve si quedó activado. */
export async function enablePush(supabase: Client) {
  if (!VAPID_PUBLIC_KEY || (await Notification.requestPermission()) !== "granted") return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
  });
  return savePushSubscription(supabase, subscription);
}

/** Da de baja este dispositivo (también al cerrar sesión: el navegador puede ser compartido). */
export async function disablePush(supabase: Client) {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await supabase.rpc("delete_push_subscription", { sub_endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}

function base64UrlToBytes(value: string) {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

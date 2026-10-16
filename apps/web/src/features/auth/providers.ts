import type { Provider } from "@supabase/supabase-js";

// Para activar Apple o Facebook: credenciales en supabase/.env (y en Supabase Cloud),
// `enabled = true` en supabase/config.toml y aquí.
export const AUTH_PROVIDERS = [
  { id: "google", label: "Google", enabled: true },
  { id: "discord", label: "Discord", enabled: false },
  { id: "apple", label: "Apple", enabled: false },
  { id: "facebook", label: "Facebook", enabled: false },
] as const satisfies readonly { id: Provider; label: string; enabled: boolean }[];

export type AuthProviderId = (typeof AUTH_PROVIDERS)[number]["id"];

export const enabledProviders = AUTH_PROVIDERS.filter((p) => p.enabled);

export function isEnabledProvider(id: string): id is AuthProviderId {
  return enabledProviders.some((p) => p.id === id);
}

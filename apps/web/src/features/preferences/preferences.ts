// Preferencias de este dispositivo (no de la cuenta): tamaño de texto, sonido y vibración.

export const TEXT_SIZES = ["normal", "large", "xlarge"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
// En cookie para que el servidor pinte ya el tamaño elegido (sin parpadeo); el CSS está en globals.css.
export const TEXT_SIZE_COOKIE = "TEXT_SIZE";

export function isTextSize(value: string | undefined): value is TextSize {
  return TEXT_SIZES.includes(value as TextSize);
}

export function setTextSize(size: TextSize) {
  document.cookie = `${TEXT_SIZE_COOKIE}=${size}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  document.documentElement.dataset.textSize = size;
}

// Sonido y vibración: activados salvo que se apaguen. localStorage puede fallar (modo privado): se ignora.
type Toggle = "sound" | "vibration";

export function isEnabled(toggle: Toggle) {
  try {
    return localStorage.getItem(`pref:${toggle}`) !== "off";
  } catch {
    return true;
  }
}

export function setEnabled(toggle: Toggle, enabled: boolean) {
  try {
    localStorage.setItem(`pref:${toggle}`, enabled ? "on" : "off");
  } catch {}
}

// Debe coincidir con el CHECK de `profiles.username` en la migración.
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

/**
 * Base para sugerir un nombre de usuario a partir del alias público del proveedor (p. ej. Discord).
 * No se usan nombre real ni email para no exponer datos personales (RGPD).
 */
export function usernameBaseFromMetadata(
  metadata: Record<string, unknown> | undefined,
): string | null {
  const handle = metadata?.preferred_username ?? metadata?.user_name;
  if (typeof handle !== "string") return null;
  const cleaned = handle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, 20);
  return isValidUsername(cleaned) ? cleaned : null;
}

/** Nombre genérico con sufijo aleatorio, para cuando no hay alias o ya está cogido. */
export function randomUsername(random: () => number = Math.random): string {
  return `ajolote${Math.floor(random() * 10_000)
    .toString()
    .padStart(4, "0")}`;
}

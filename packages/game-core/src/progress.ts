// XP y niveles. El servidor suma la XP (supabase/migrations/*_xp_and_levels.sql); el nivel y el título se derivan
// de ese total aquí, para mostrarlos.

/** Pasar del nivel n al n+1 cuesta n × xpStep. Título nuevo cada `titleEvery` niveles hasta `lastTitleLevel`. */
export const LEVELS = {
  xpStep: 100,
  titleEvery: 5,
  lastTitleLevel: 50,
} as const;

/** XP total necesaria para llegar al nivel `level` (el 1 es gratis). */
export function xpForLevel(level: number) {
  return (LEVELS.xpStep * level * (level - 1)) / 2;
}

/** Nivel, XP dentro del nivel y XP que pide el nivel para subir al siguiente. */
export function levelProgress(xp: number) {
  // Inversa de xpForLevel; se corrige el redondeo de la raíz.
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * xp) / LEVELS.xpStep)) / 2));
  while (xpForLevel(level + 1) <= xp) level++;
  while (level > 1 && xpForLevel(level) > xp) level--;
  return { level, current: xp - xpForLevel(level), needed: level * LEVELS.xpStep };
}

export type TitleLevel = 1 | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50;

/** Nivel con el que se ganó el título vigente (1, 5, 10… 50): sirve de clave para su texto. */
export function titleLevel(level: number): TitleLevel {
  const reached =
    Math.floor(Math.min(level, LEVELS.lastTitleLevel) / LEVELS.titleEvery) * LEVELS.titleEvery;
  return Math.max(1, reached) as TitleLevel;
}

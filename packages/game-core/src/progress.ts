// XP y niveles. El servidor suma la XP (supabase/migrations/*_xp_and_levels.sql); el nivel y el título se derivan
// de ese total aquí, para mostrarlos.

/**
 * Pasar del nivel 1 al 2 cuesta `firstLevelXp` y cada nivel siguiente un `growth` más (13 %): fácil al principio
 * y cada vez más duro. Título nuevo cada `titleEvery` niveles hasta `lastTitleLevel`.
 */
export const LEVELS = {
  firstLevelXp: 50,
  growth: 1.13,
  titleEvery: 5,
  lastTitleLevel: 50,
} as const;

/** XP que cuesta pasar del nivel `level` al siguiente. */
export function levelCost(level: number) {
  return Math.round(LEVELS.firstLevelXp * LEVELS.growth ** (level - 1));
}

/** XP total necesaria para llegar al nivel `level` (el 1 es gratis). */
export function xpForLevel(level: number) {
  let total = 0;
  for (let n = 1; n < level; n++) total += levelCost(n);
  return total;
}

/** Nivel, XP dentro del nivel y XP que pide el nivel para subir al siguiente. */
export function levelProgress(xp: number) {
  // Al ser exponencial, incluso millones de XP son pocas vueltas.
  let level = 1;
  let floor = 0;
  while (floor + levelCost(level) <= xp) floor += levelCost(level++);
  return { level, current: xp - floor, needed: levelCost(level) };
}

export type TitleLevel = 1 | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50;

/** Nivel con el que se ganó el título vigente (1, 5, 10… 50): sirve de clave para su texto. */
export function titleLevel(level: number): TitleLevel {
  const reached =
    Math.floor(Math.min(level, LEVELS.lastTitleLevel) / LEVELS.titleEvery) * LEVELS.titleEvery;
  return Math.max(1, reached) as TitleLevel;
}

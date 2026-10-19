// Datos comunes de los textos legales.
// Al cambiar los términos o la privacidad de forma relevante: subir `version` y `updated` (se guarda la versión aceptada).
export const LEGAL = {
  version: 1,
  updated: "2026-10-20",
  minAge: 14,
  // shortcut: provisionales, rellenar antes de la beta (CLAUDE.md > Estado y pendientes).
  controller: "[NOMBRE DEL RESPONSABLE]",
  email: "[EMAIL DE CONTACTO]",
} as const;

/** Un texto legal: secciones con párrafos; un array dentro de `body` es una lista. */
export type LegalDocument = {
  title: string;
  sections: { heading: string; body: (string | string[])[] }[];
};

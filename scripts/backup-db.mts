// Copia completa de la BD (roles, esquema y datos) en .backups/<fecha>/. Uso: pnpm db:backup [--local]
// Necesita Docker en marcha y SUPABASE_DB_URL en el entorno (docs/produccion.md > "Copias de seguridad").
// Llevan datos personales: no se suben a ningún sitio y se borran a los 30 días (lo promete la política de privacidad).
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";

const ROOT = ".backups";
const KEEP_DAYS = 30;

const local = process.argv.includes("--local");
const dbUrl = process.env.SUPABASE_DB_URL;
if (!local && !dbUrl) throw new Error("Falta SUPABASE_DB_URL en el entorno (o usa --local).");
const source = local ? ["--local"] : ["--db-url", dbUrl!];

const dir = `${ROOT}/${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}`;
mkdirSync(dir, { recursive: true });

const dumps: [string, string[]][] = [
  ["roles.sql", ["--role-only"]],
  ["schema.sql", []],
  ["data.sql", ["--data-only", "--use-copy"]],
];
for (const [file, flags] of dumps) {
  // La CLI con node directamente (sin shell): la URL lleva la contraseña y caracteres especiales.
  execFileSync(
    process.execPath,
    [
      "node_modules/supabase/dist/supabase.js",
      "db",
      "dump",
      ...source,
      ...flags,
      "-f",
      `${dir}/${file}`,
    ],
    { stdio: "inherit" },
  );
}
console.log(`Copia guardada en ${dir}`);

const limit = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
for (const name of readdirSync(ROOT)) {
  const path = `${ROOT}/${name}`;
  if (path !== dir && statSync(path).mtimeMs < limit) {
    rmSync(path, { recursive: true });
    console.log(`Borrada la copia antigua ${path}`);
  }
}

// Importación masiva de preguntas desde un JSON (formato documentado en la función SQL `import_questions`).
// Uso: node scripts/import-questions.mts <archivo.json> [--local]
//   --local   usa la URL y la clave secreta de Supabase local (`supabase status`).
//   si no,    lee SUPABASE_URL y SUPABASE_SECRET_KEY del entorno. La clave secreta nunca va al repo.
// Cada lote es una transacción y la importación es idempotente (por externalId): si falla, corrige y repite.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BATCH_SIZE = 500;

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error("Uso: node scripts/import-questions.mts <archivo.json> [--local]");
  process.exit(1);
}

function credentials() {
  if (flag === "--local") {
    const status = JSON.parse(execSync("pnpm exec supabase status -o json", { encoding: "utf8" }));
    return { url: status.API_URL as string, key: status.SECRET_KEY as string };
  }
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = process.env;
  if (!url || !key) throw new Error("Faltan SUPABASE_URL y SUPABASE_SECRET_KEY en el entorno.");
  return { url, key };
}

const items: unknown = JSON.parse(readFileSync(file, "utf8"));
if (!Array.isArray(items)) throw new Error("El archivo debe contener un array de preguntas.");

const { url, key } = credentials();
let imported = 0;
for (let start = 0; start < items.length; start += BATCH_SIZE) {
  const response = await fetch(`${url}/rest/v1/rpc/import_questions`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ items: items.slice(start, start + BATCH_SIZE) }),
  });
  if (!response.ok) {
    throw new Error(
      `Lote que empieza en ${start} (${imported} ya importadas): ${await response.text()}`,
    );
  }
  imported += (await response.json()) as number;
}
console.log(`${imported} preguntas importadas.`);

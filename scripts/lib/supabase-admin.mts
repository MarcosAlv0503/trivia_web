// Acceso a la BD con la clave secreta para los scripts de contenido. Nunca se usa desde la web.
//   local = true  usa la URL y la clave secreta de Supabase local (`supabase status`).
//   si no,        lee SUPABASE_URL y SUPABASE_SECRET_KEY del entorno. La clave secreta nunca va al repo.
import { execSync } from "node:child_process";

const BATCH_SIZE = 500;

let cached: { url: string; key: string } | undefined;

function credentials(local: boolean) {
  if (cached) return cached;
  if (local) {
    const status = JSON.parse(execSync("pnpm exec supabase status -o json", { encoding: "utf8" }));
    return (cached = { url: status.API_URL as string, key: status.SECRET_KEY as string });
  }
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = process.env;
  if (!url || !key) throw new Error("Faltan SUPABASE_URL y SUPABASE_SECRET_KEY en el entorno.");
  return (cached = { url, key });
}

export async function rpc<T>(fn: string, args: unknown, local: boolean): Promise<T> {
  const { url, key } = credentials(local);
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error(`${fn}: ${await response.text()}`);
  return (await response.json()) as T;
}

// Cada lote es una transacción y la importación es idempotente (por externalId): si falla, corrige y repite.
export async function importQuestions(items: unknown[], local: boolean) {
  let imported = 0;
  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    try {
      imported += await rpc<number>(
        "import_questions",
        { items: items.slice(start, start + BATCH_SIZE) },
        local,
      );
    } catch (error) {
      throw new Error(
        `Lote que empieza en ${start} (${imported} ya importadas): ${(error as Error).message}`,
      );
    }
  }
  return imported;
}

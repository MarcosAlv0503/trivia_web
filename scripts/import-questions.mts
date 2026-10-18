// Importación masiva de preguntas desde un JSON (formato documentado en la función SQL `import_questions`).
// Uso: node scripts/import-questions.mts <archivo.json> [--local]
//   --local   usa Supabase local; si no, SUPABASE_URL y SUPABASE_SECRET_KEY del entorno.
import { readFileSync } from "node:fs";
import { importQuestions } from "./lib/supabase-admin.mts";

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error("Uso: node scripts/import-questions.mts <archivo.json> [--local]");
  process.exit(1);
}

const items: unknown = JSON.parse(readFileSync(file, "utf8"));
if (!Array.isArray(items)) throw new Error("El archivo debe contener un array de preguntas.");

console.log(`${await importQuestions(items, flag === "--local")} preguntas importadas.`);

// Parte mecánica de los procesos de contenido (`.claude/skills/questions-*`): Claude decide, esto lee y escribe la BD.
// Uso: pnpm questions <comando> [argumentos]   (Supabase local salvo que SUPABASE_URL esté definida)
//   status                          recuento por categoría y dificultad, y qué conviene generar
//   existing <categoría>            preguntas que ya existen en esa categoría (para no repetir)
//   to-translate <idioma> [n=30]    aprobadas sin ese idioma          → .content/to-translate-<idioma>.json
//   to-review [n=15]                candidatas a revisión con motivo  → .content/to-review.json
//   import <archivo>                importa preguntas siempre como borrador (o conservando su estado)
//   untranslatable <idioma> <archivo>  marca como no traducibles los externalId del archivo (array)
//   apply-reviews <archivo>         importa las correcciones y aplica los veredictos
// Los archivos de trabajo van a `.content/` (ignorada por git): el repo es público y llevan las respuestas.
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { importQuestions, rpc } from "./lib/supabase-admin.mts";

type Translation = { prompt: string; correct: string; wrong: string[] };
type Question = {
  externalId: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "approved" | "rejected";
  source: string;
  topical: boolean;
  expiresAt: string | null;
  createdAt: string;
  reviewedAt: string | null;
  needsHuman: boolean;
  reviewNote: string | null;
  untranslatable: string[];
  translations: Record<string, Translation>;
  /** Reportes de jugadores aún sin resolver. */
  reports: { reason: string; locale: string }[];
  stats: { answered: number; correct: number; topWrong: number };
};

const WORK_DIR = ".content";
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
// Tasa de acierto esperada por dificultad; fuera de la banda (con bastantes respuestas) se revisa la pregunta.
const EXPECTED_HIT_RATE = { easy: [0.5, 1], medium: [0.25, 0.9], hard: [0, 0.85] } as const;
const MIN_ANSWERS_FOR_STATS = 20;
const EXPIRY_WARNING_DAYS = 14;
// Proporción de preguntas de actualidad vigentes que se intenta mantener entre las aprobadas.
const TOPICAL_SHARE = 0.1;

const args = process.argv.slice(2);
const local = args.includes("--local") || !process.env.SUPABASE_URL;
const [command, ...rest] = args.filter((a) => a !== "--local");

const exportAll = () => rpc<Question[]>("export_questions", {}, local);
const readJson = <T,>(file: string) => JSON.parse(readFileSync(file, "utf8")) as T;
const sourceLocale = (q: Question) => (q.translations.es ? "es" : Object.keys(q.translations)[0]!);

function writeWork(name: string, data: unknown) {
  mkdirSync(WORK_DIR, { recursive: true });
  const path = `${WORK_DIR}/${name}`;
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  return path;
}

// Solo los campos que entiende import_questions; sin "status" para no cambiarlo al reimportar.
function importable(
  q: Pick<Question, "externalId" | "category" | "difficulty" | "source" | "topical" | "expiresAt">,
) {
  const { externalId, category, difficulty, source, topical, expiresAt } = q;
  return { externalId, category, difficulty, source, topical, expiresAt };
}

const isActiveTopical = (q: Question) =>
  q.topical &&
  q.status === "approved" &&
  q.expiresAt !== null &&
  new Date(q.expiresAt) > new Date();

async function status() {
  const all = await exportAll();
  const categories = [...new Set(all.map((q) => q.category))].sort();
  const cells: { category: string; difficulty: string; pending: number; approved: number }[] = [];
  for (const category of categories) {
    for (const difficulty of DIFFICULTIES) {
      const qs = all.filter((q) => q.category === category && q.difficulty === difficulty);
      const approved = qs.filter((q) => q.status === "approved").length;
      const draft = qs.filter((q) => q.status === "draft" && !q.needsHuman).length;
      const human = qs.filter((q) => q.needsHuman).length;
      cells.push({ category, difficulty, pending: approved + draft, approved });
      console.log(
        `${category.padEnd(16)} ${difficulty.padEnd(6)} aprobadas=${approved} borradores=${draft} humano=${human}`,
      );
    }
  }
  const approved = all.filter((q) => q.status === "approved").length;
  const topical = all.filter(isActiveTopical).length;
  const reported = all.filter((q) => q.status === "approved" && q.reports.length).length;
  console.log(
    `\nTotal aprobadas: ${approved} · actualidad vigentes: ${topical} · reportadas: ${reported}`,
  );
  for (const locale of ["es", "en"]) {
    const missing = all.filter(
      (q) =>
        q.status === "approved" && !q.translations[locale] && !q.untranslatable.includes(locale),
    ).length;
    console.log(`Aprobadas sin traducir a ${locale}: ${missing}`);
  }
  // Lo siguiente a generar: actualidad si está por debajo de su cuota; si no, la celda con menos preguntas.
  const next = cells.sort((a, b) => a.pending - b.pending)[0];
  console.log(
    topical < approved * TOPICAL_SHARE
      ? "\nSiguiente: actualidad (por debajo de su cuota)"
      : `\nSiguiente: ${next?.category} ${next?.difficulty}`,
  );
}

async function existing(category: string) {
  const all = await exportAll();
  for (const q of all.filter((q) => q.category === category)) {
    const t = q.translations[sourceLocale(q)]!;
    console.log(
      `[${q.difficulty}${q.topical ? ", actualidad" : ""}, ${q.status}] ${t.prompt} → ${t.correct}`,
    );
  }
}

async function toTranslate(locale: string, limit: number) {
  const pending = (await exportAll())
    .filter(
      (q) =>
        q.status === "approved" && !q.translations[locale] && !q.untranslatable.includes(locale),
    )
    .slice(0, limit)
    .map((q) => ({
      ...importable(q),
      translations: { [sourceLocale(q)]: q.translations[sourceLocale(q)] },
    }));
  console.log(
    `${pending.length} preguntas por traducir → ${writeWork(`to-translate-${locale}.json`, pending)}`,
  );
}

function reviewReason(q: Question, now: Date): string | null {
  if (q.status === "draft" && !q.needsHuman) return "nueva";
  if (q.status !== "approved") return null;
  if (q.reports.length)
    return `reportada: ${q.reports.map((r) => `${r.reason} (${r.locale})`).join(", ")}`;
  const warn = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 86_400_000);
  if (q.topical && q.expiresAt && new Date(q.expiresAt) < warn) return "caduca pronto";
  const { answered, correct, topWrong } = q.stats;
  if (answered >= MIN_ANSWERS_FOR_STATS) {
    if (topWrong > correct) return "una incorrecta se elige más que la correcta";
    const [min, max] = EXPECTED_HIT_RATE[q.difficulty];
    const rate = correct / answered;
    if (rate < min || rate > max)
      return `acierto del ${Math.round(rate * 100)}%, raro para "${q.difficulty}"`;
  }
  return null;
}

async function toReview(limit: number) {
  const all = await exportAll();
  const now = new Date();
  // Primero las reportadas por jugadores; después, el resto con motivo.
  const flagged = all
    .flatMap((q) => {
      const reason = reviewReason(q, now);
      return reason ? [{ reason, q }] : [];
    })
    .sort((a, b) => b.q.reports.length - a.q.reports.length);
  // El resto del cupo, auditoría de las aprobadas revisadas hace más tiempo (o nunca).
  const audit = all
    .filter((q) => q.status === "approved" && !flagged.some((f) => f.q === q))
    .sort((a, b) => (a.reviewedAt ?? "").localeCompare(b.reviewedAt ?? ""))
    .map((q) => ({ reason: "auditoría", q }));
  const picked = [...flagged, ...audit].slice(0, limit).map(({ reason, q }) => ({
    reason,
    ...importable(q),
    status: q.status,
    reviewNote: q.reviewNote,
    stats: q.stats,
    translations: q.translations,
  }));
  console.log(`${picked.length} preguntas por revisar → ${writeWork("to-review.json", picked)}`);
}

async function importFile(file: string) {
  const items = readJson<Record<string, unknown>[]>(file).map(({ status: _ignored, ...item }) => ({
    ...item,
    externalId: item.externalId ?? `ai-${randomUUID()}`,
  }));
  console.log(`${await importQuestions(items, local)} preguntas importadas como borrador.`);
}

async function untranslatable(locale: string, file: string) {
  const ids = readJson<string[]>(file);
  console.log(
    `${await rpc<number>("mark_untranslatable", { external_ids: ids, target_locale: locale }, local)} marcadas.`,
  );
}

type Review = {
  externalId: string;
  verdict: string;
  note?: string;
  expiresAt?: string;
  fixed?: Partial<Question> & Pick<Question, "translations">;
};

async function applyReviews(file: string) {
  const reviews = readJson<Review[]>(file);
  const all = reviews.some((r) => r.fixed) ? await exportAll() : [];
  // Una corrección parte de la pregunta actual: basta con indicar lo que cambia (al menos las traducciones).
  const fixes = reviews.flatMap((r) => {
    const current = all.find((q) => q.externalId === r.externalId);
    if (!r.fixed || !current) return [];
    return [
      {
        ...importable({ ...current, ...r.fixed, externalId: r.externalId }),
        translations: r.fixed.translations,
      },
    ];
  });
  if (fixes.length) console.log(`${await importQuestions(fixes, local)} correcciones importadas.`);
  const verdicts = reviews.map(({ fixed: _fixed, ...r }) => r);
  console.log(
    `${await rpc<number>("review_questions", { items: verdicts }, local)} revisiones aplicadas.`,
  );
}

// [argumentos obligatorios, ejecución]
const commands: Record<string, [number, () => Promise<void>]> = {
  status: [0, status],
  existing: [1, () => existing(rest[0]!)],
  "to-translate": [1, () => toTranslate(rest[0]!, Number(rest[1] ?? 30))],
  "to-review": [0, () => toReview(Number(rest[0] ?? 15))],
  import: [1, () => importFile(rest[0]!)],
  untranslatable: [2, () => untranslatable(rest[0]!, rest[1]!)],
  "apply-reviews": [1, () => applyReviews(rest[0]!)],
};

const entry = command ? commands[command] : undefined;
if (!entry || rest.length < entry[0]) {
  console.error("Uso: ver la cabecera de scripts/questions.mts.");
  process.exit(1);
}
await entry[1]();

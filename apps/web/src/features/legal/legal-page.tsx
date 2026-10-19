import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import type { Locale } from "@/i18n/config";
import * as en from "./content/en";
import * as es from "./content/es";
import { LEGAL } from "./legal";

// Los textos legales van fuera de `messages/*.json`: el proveedor de next-intl manda esos mensajes a todas las páginas.
const CONTENT: Record<Locale, typeof es> = { es, en };
export type LegalKind = keyof typeof es;

async function getDocument(kind: LegalKind) {
  return CONTENT[(await getLocale()) as Locale][kind];
}

export async function legalMetadata(kind: LegalKind): Promise<Metadata> {
  return { title: (await getDocument(kind)).title };
}

export async function LegalPage({ kind }: { kind: LegalKind }) {
  const [doc, t] = await Promise.all([getDocument(kind), getTranslations("Legal")]);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <BackLink href="/" label={t("back")} />
        <h1 className="text-3xl font-bold">{doc.title}</h1>
      </div>
      {/* Mediodía UTC: la fecha no cambia de día en ninguna zona horaria. */}
      <p className="text-fg-muted">
        {t("updated", { date: new Date(`${LEGAL.updated}T12:00:00Z`) })}
      </p>
      {doc.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">{section.heading}</h2>
          {section.body.map((block, i) =>
            typeof block === "string" ? (
              <p key={i}>{block}</p>
            ) : (
              <ul key={i} className="flex list-disc flex-col gap-1 pl-6">
                {block.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
    </main>
  );
}

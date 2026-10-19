"use client";

import { useState } from "react";
import { buttonClassName } from "@/components/button";
import { Mascot } from "@/components/mascot";
import { QuestionCard } from "@/components/question-card";
import { Wheel } from "@/components/wheel";
import { AnswerFeedback } from "@/features/game/answer-feedback";
import { Avatar } from "@/features/profile/avatar";

// Datos de ejemplo solo para desarrollo (sin i18n a propósito). Los colores de categoría
// aprobados en la Fase 1; en la Fase 2 vivirán en la tabla de categorías.
const CATEGORIES = [
  { id: "geography", label: "Geografía", color: "#2ECC8F" },
  { id: "history", label: "Historia", color: "#D9964A" },
  { id: "science", label: "Ciencia", color: "#2EC4E6" },
  { id: "art-literature", label: "Arte y Lit.", color: "#9B7BFF" },
  { id: "entertainment", label: "Entreten.", color: "#FF7A45" },
  { id: "sports", label: "Deportes", color: "#F5C431" },
  { id: "technology", label: "Tecnología", color: "#5C7CFA" },
];

const ANSWERS = [
  { id: "a", text: "Lago Titicaca" },
  { id: "b", text: "Lago de Xochimilco" },
  { id: "c", text: "Lago Ness" },
  { id: "d", text: "Lago Victoria" },
];

const AVATAR_IDS = [
  "axolotl-pink",
  "axolotl-gold",
  "axolotl-mint",
  "axolotl-sky",
  "axolotl-lilac",
  "axolotl-coral",
  "axolotl-pink-glasses",
  "axolotl-gold-bow",
  "axolotl-mint-cap",
  "axolotl-sky-glasses",
  "axolotl-lilac-bow",
  "axolotl-coral-cap",
];

export function Showcase() {
  const [selected, setSelected] = useState<string>();
  const [target, setTarget] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  // `id` cambia en cada pulsación para volver a montar la animación aunque se repita el mismo caso.
  const [feedback, setFeedback] = useState<{ id: number; points: number } | null>(null);

  function spin() {
    setSpinning(true);
    // En el juego real el resultado lo decide el servidor.
    setTarget(null);
    requestAnimationFrame(() => setTarget(Math.floor(Math.random() * CATEGORIES.length)));
  }

  return (
    <main className="mx-auto grid max-w-4xl gap-10 p-6">
      <header className="flex items-center gap-6">
        <Mascot size={110} />
        <div>
          <p className="text-xs font-extrabold tracking-widest text-fg-muted uppercase">/dev/ui</p>
          <h1 className="text-4xl font-bold">Muestrario de componentes</h1>
        </div>
      </header>

      <section className="grid gap-4">
        <h2 className="text-2xl font-bold">Botones</h2>
        <div className="flex flex-wrap gap-4">
          <button type="button" className={buttonClassName("play")}>
            ¡Jugar!
          </button>
          <button type="button" className={buttonClassName("primary")}>
            Primario
          </button>
          <button type="button" className={buttonClassName("secondary")}>
            Secundario
          </button>
          <button type="button" className={buttonClassName("danger")}>
            Peligro
          </button>
          <button type="button" disabled className={buttonClassName("primary")}>
            Desactivado
          </button>
        </div>
      </section>

      <section className="grid items-start gap-8 md:grid-cols-[1.2fr_1fr]">
        <div className="grid gap-4">
          <h2 className="text-2xl font-bold">Tarjeta de pregunta</h2>
          <QuestionCard
            category={CATEGORIES[0]!}
            badge="Actualidad"
            question="¿En qué lago vive el ajolote en estado salvaje?"
            answers={ANSWERS}
            timeLeft={0.62}
            timeLimitMs={15000}
            selectedId={selected}
            correctId={selected ? "b" : undefined}
            onAnswer={setSelected}
            timerLabel="Tiempo restante"
          />
          <button
            type="button"
            className={buttonClassName("secondary", "justify-self-start")}
            onClick={() => setSelected(undefined)}
          >
            Reiniciar
          </button>
        </div>

        <div className="grid justify-items-center gap-4">
          <h2 className="justify-self-start text-2xl font-bold">Ruleta</h2>
          <Wheel segments={CATEGORIES} target={target} onSpinEnd={() => setSpinning(false)} />
          <button
            type="button"
            className={buttonClassName("primary")}
            onClick={spin}
            disabled={spinning}
          >
            Girar
          </button>
          <p aria-live="polite" className="text-fg-muted">
            {target !== null && !spinning ? `Ha tocado: ${CATEGORIES[target]!.label}` : " "}
          </p>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-2xl font-bold">Mensaje de acierto</h2>
        <div className="flex flex-wrap gap-3">
          {[
            ["Normal (+10)", 10],
            ["Rápido (+12)", 12],
            ["Muy rápido (+15)", 15],
            ["Fallo", 0],
          ].map(([label, points]) => (
            <button
              key={label}
              type="button"
              className={buttonClassName("secondary")}
              onClick={() => setFeedback({ id: Date.now(), points: Number(points) })}
            >
              {label}
            </button>
          ))}
        </div>
        <AnswerFeedback
          key={feedback?.id}
          result={feedback && { isCorrect: feedback.points > 0, points: feedback.points }}
          timedOut={false}
        />
      </section>

      <section className="grid gap-4">
        <h2 className="text-2xl font-bold">Avatares</h2>
        <div className="flex flex-wrap gap-3">
          {AVATAR_IDS.map((id) => (
            <Avatar key={id} id={id} size={56} className="rounded-full border-3 border-sticker" />
          ))}
        </div>
      </section>
    </main>
  );
}

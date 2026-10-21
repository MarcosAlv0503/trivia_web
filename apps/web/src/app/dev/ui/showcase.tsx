"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LIVE, type OutcomeKind, type TitleLevel } from "@trivia/game-core";
import { AnalogClock } from "@/components/analog-clock";
import { buttonClassName } from "@/components/button";
import { Mascot } from "@/components/mascot";
import { QuestionCard } from "@/components/question-card";
import { Wheel } from "@/components/wheel";
import { AnswerFeedback } from "@/features/game/answer-feedback";
import { MatchOutcome } from "@/features/game/match-outcome";
import { Avatar } from "@/features/profile/avatar";
import { TitleIcon } from "@/components/title-icon";
import { LevelBadge } from "@/features/progress/level-badge";
import { LevelCard } from "@/features/progress/level-card";
import { XpGain } from "@/features/progress/xp-gain";
import { CategoryStats } from "@/features/stats/category-stats";
import { DailySquares } from "@/features/daily/daily-squares";

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

const TITLE_LEVELS: TitleLevel[] = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

export function Showcase() {
  const [selected, setSelected] = useState<string>();
  const [target, setTarget] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  // `id` cambia en cada pulsación para volver a montar la animación aunque se repita el mismo caso.
  const [feedback, setFeedback] = useState<{ id: number; points: number } | null>(null);
  const tProgress = useTranslations("Progress");
  const [xp, setXp] = useState<{ id: number; gained: number; total: number } | null>(null);
  const [outcome, setOutcome] = useState<{ kind: OutcomeKind; names?: string[] } | null>(null);
  const [clockMs, setClockMs] = useState(42_000);

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
          result={
            feedback && { isCorrect: feedback.points > 0, points: feedback.points, hitRate: 34 }
          }
          timedOut={false}
        />
      </section>

      <section className="grid max-w-md gap-4">
        <h2 className="text-2xl font-bold">Reto diario: cuadritos</h2>
        {[42, 36, 20].map((size) => (
          <DailySquares
            key={size}
            size={size}
            rounds={[
              ["geography", "#2ECC8F"],
              ["history", "#D9964A"],
              ["science", "#2EC4E6"],
              ["art-literature", "#9B7BFF"],
              ["entertainment", "#FF7A45"],
              ["sports", "#F5C431"],
              ["technology", "#5C7CFA"],
            ].map(([id, color], i) => ({
              categoryId: id!,
              name: id!,
              color: color!,
              correct: i !== 2 && i !== 5,
            }))}
          />
        ))}
      </section>

      <section className="grid max-w-md gap-4">
        <h2 className="text-2xl font-bold">Estadísticas</h2>
        <CategoryStats
          stats={[
            { id: "geography", name: "Geografía", color: "#2ECC8F", answered: 42, correct: 35 },
            { id: "history", name: "Historia", color: "#D9964A", answered: 30, correct: 12 },
            {
              id: "science",
              name: "Ciencia y Naturaleza",
              color: "#2EC4E6",
              answered: 25,
              correct: 15,
            },
            {
              id: "art-literature",
              name: "Arte y Literatura",
              color: "#9B7BFF",
              answered: 1,
              correct: 1,
            },
            {
              id: "entertainment",
              name: "Entretenimiento",
              color: "#FF7A45",
              answered: 18,
              correct: 10,
            },
            { id: "sports", name: "Deportes", color: "#F5C431", answered: 0, correct: 0 },
            { id: "technology", name: "Tecnología", color: "#5C7CFA", answered: 12, correct: 8 },
          ]}
        />
      </section>

      <section className="grid max-w-md gap-4">
        <h2 className="text-2xl font-bold">XP y niveles</h2>
        <div className="flex flex-wrap gap-3">
          {[
            ["Sin subir (+20)", 20, 140],
            ["Sube de nivel (+40)", 40, 180],
            ["Título nuevo (+30)", 30, 250],
          ].map(([label, gained, total]) => (
            <button
              key={label}
              type="button"
              className={buttonClassName("secondary")}
              onClick={() =>
                setXp({ id: Date.now(), gained: Number(gained), total: Number(total) })
              }
            >
              {label}
            </button>
          ))}
        </div>
        {xp && <XpGain key={xp.id} gained={xp.gained} total={xp.total} />}
        <LevelCard xp={1010} />
        <div className="flex gap-2">
          {[0, 320, 4500, 153031].map((value) => (
            <LevelBadge key={value} xp={value} />
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TITLE_LEVELS.map((level) => (
            <li key={level} className="flex items-center gap-2 font-bold">
              <TitleIcon level={level} size={44} />
              <span>
                {level} · {tProgress(`titles.${level}`)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4">
        <h2 className="text-2xl font-bold">Duelo relámpago: reloj</h2>
        <div className="flex flex-wrap items-center gap-6">
          <AnalogClock
            remainingMs={clockMs}
            totalMs={LIVE.matchMs}
            questionLeft={0.6}
            warning={clockMs <= LIVE.warningMs}
            label={`${Math.ceil(clockMs / 1000)} s`}
          />
          <input
            type="range"
            min={0}
            max={LIVE.matchMs}
            step={500}
            value={clockMs}
            onChange={(e) => setClockMs(Number(e.target.value))}
            aria-label="Tiempo restante"
            className="w-48 accent-accent"
          />
          <span className="font-display text-2xl font-bold">{Math.ceil(clockMs / 1000)} s</span>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-2xl font-bold">Finales de partida</h2>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["Victoria", "victory"],
              ["Victoria en local", "victory", ["Bea"]],
              ["Derrota", "defeat"],
              ["Empate", "draw"],
              ["Empate legendario", "legendaryDraw"],
              ["Empate legendario en local", "legendaryDraw", ["Ana", "Bea"]],
            ] as const
          ).map(([label, kind, names]) => (
            <button
              key={label}
              type="button"
              className={buttonClassName("secondary")}
              onClick={() => setOutcome({ kind, names: names && [...names] })}
            >
              {label}
            </button>
          ))}
        </div>
        {outcome && (
          <MatchOutcome kind={outcome.kind} names={outcome.names} onDone={() => setOutcome(null)} />
        )}
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

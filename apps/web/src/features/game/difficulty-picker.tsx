"use client";

import { useTranslations } from "next-intl";
import { DIFFICULTIES, type Difficulty } from "@trivia/game-core";

type Props = { name: string; value: Difficulty; onChange: (value: Difficulty) => void };

/** Fácil / Normal / Difícil como grupo de radios (se envía en formularios con `name`). */
export function DifficultyPicker({ name, value, onChange }: Props) {
  const t = useTranslations("Quick");
  return (
    <div className="grid grid-cols-3 gap-2">
      {DIFFICULTIES.map((d) => (
        <label key={d} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={d}
            checked={value === d}
            onChange={() => onChange(d)}
            className="peer sr-only"
          />
          <span className="block rounded-2xl bg-surface-2 px-2 py-2.5 text-center font-display font-bold sticker peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:ring-4 peer-focus-visible:ring-fg">
            {t(`difficulties.${d}`)}
          </span>
        </label>
      ))}
    </div>
  );
}

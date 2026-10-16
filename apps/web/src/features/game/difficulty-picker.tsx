"use client";

import { useTranslations } from "next-intl";
import { DIFFICULTIES, type Difficulty } from "@trivia/game-core";

type SegmentedProps<T extends string | number> = {
  name: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** Opciones excluyentes en botones como grupo de radios (se envía en formularios con `name`). */
export function SegmentedPicker<T extends string | number>({
  name,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-2">
      {options.map((option) => (
        <label key={option.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span className="block rounded-2xl bg-surface-2 px-2 py-2.5 text-center font-display font-bold sticker peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:ring-4 peer-focus-visible:ring-fg">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Fácil / Normal / Difícil. */
export function DifficultyPicker({
  name,
  value,
  onChange,
}: Omit<SegmentedProps<Difficulty>, "options">) {
  const t = useTranslations("Quick");
  return (
    <SegmentedPicker
      name={name}
      value={value}
      onChange={onChange}
      options={DIFFICULTIES.map((d) => ({ value: d, label: t(`difficulties.${d}`) }))}
    />
  );
}

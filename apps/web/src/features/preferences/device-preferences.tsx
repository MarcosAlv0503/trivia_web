"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SegmentedPicker } from "@/features/game/difficulty-picker";
import {
  isEnabled,
  isTextSize,
  setEnabled,
  setTextSize,
  TEXT_SIZES,
  type TextSize,
} from "./preferences";

/** Tamaño de texto, sonido y vibración de este dispositivo. */
export function DevicePreferences() {
  const t = useTranslations("Preferences");
  const [size, setSize] = useState<TextSize>("normal");
  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState<boolean | null>(null);

  // Se leen tras montar: dependen del navegador (cookie, localStorage, soporte de vibración).
  useEffect(() => {
    const current = document.documentElement.dataset.textSize;
    /* eslint-disable react-hooks/set-state-in-effect -- valores que solo existen en el navegador */
    if (isTextSize(current)) setSize(current);
    setSound(isEnabled("sound"));
    setVibration("vibrate" in navigator ? isEnabled("vibration") : null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  return (
    <section className="flex w-full max-w-md flex-col gap-4 border-t-2 border-surface-2 pt-6">
      <h2 className="font-display text-lg font-bold">{t("title")}</h2>
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-bold">{t("textSize")}</legend>
        <SegmentedPicker
          name="textSize"
          value={size}
          onChange={(value) => {
            setSize(value);
            setTextSize(value);
          }}
          options={TEXT_SIZES.map((value) => ({ value, label: t(`sizes.${value}`) }))}
        />
      </fieldset>
      <label className="flex items-center gap-3 font-bold">
        <input
          type="checkbox"
          className="size-5 accent-accent"
          checked={sound}
          onChange={(e) => {
            setSound(e.target.checked);
            setEnabled("sound", e.target.checked);
          }}
        />
        {t("sound")}
      </label>
      {/* Sin soporte (p. ej. iPhone) no se ofrece. */}
      {vibration !== null && (
        <label className="flex items-center gap-3 font-bold">
          <input
            type="checkbox"
            className="size-5 accent-accent"
            checked={vibration}
            onChange={(e) => {
              setVibration(e.target.checked);
              setEnabled("vibration", e.target.checked);
            }}
          />
          {t("vibration")}
        </label>
      )}
    </section>
  );
}

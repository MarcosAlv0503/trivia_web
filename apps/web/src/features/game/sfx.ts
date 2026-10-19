"use client";

import { isEnabled } from "@/features/preferences/preferences";

// Efectos de sonido sintetizados con Web Audio (sin archivos) y vibración (solo donde el navegador la admite:
// Android sí, iPhone no). Ambos se pueden apagar en el perfil.

export type Sound = "correct" | "fast" | "veryFast" | "wrong" | "timeout" | "tick" | "spin" | "win";

// [frecuencia Hz, inicio s, duración s]
type Note = [number, number, number];

const SOUNDS: Record<
  Sound,
  { wave: OscillatorType; volume: number; notes: Note[]; slideTo?: number }
> = {
  correct: {
    wave: "triangle",
    volume: 0.2,
    notes: [
      [523, 0, 0.09],
      [784, 0.08, 0.16],
    ],
  },
  fast: {
    wave: "triangle",
    volume: 0.2,
    notes: [
      [523, 0, 0.08],
      [659, 0.07, 0.08],
      [784, 0.14, 0.18],
    ],
  },
  veryFast: {
    wave: "triangle",
    volume: 0.22,
    notes: [
      [523, 0, 0.07],
      [659, 0.06, 0.07],
      [784, 0.12, 0.07],
      [1047, 0.18, 0.24],
    ],
  },
  wrong: { wave: "square", volume: 0.07, notes: [[220, 0, 0.3]], slideTo: 130 },
  timeout: {
    wave: "square",
    volume: 0.07,
    notes: [
      [330, 0, 0.14],
      [220, 0.16, 0.24],
    ],
  },
  tick: { wave: "sine", volume: 0.12, notes: [[1200, 0, 0.04]] },
  // Clics que se espacian como la ruleta al frenar (gira 3,2 s).
  spin: {
    wave: "triangle",
    volume: 0.1,
    notes: Array.from({ length: 22 }, (_, i): Note => [900, 3.1 * (i / 22) ** 1.8, 0.03]),
  },
  win: {
    wave: "triangle",
    volume: 0.2,
    notes: [
      [523, 0, 0.12],
      [659, 0.12, 0.12],
      [784, 0.24, 0.12],
      [1047, 0.36, 0.4],
    ],
  },
};

let context: AudioContext | undefined;

function audio() {
  context ??= new AudioContext();
  // Los navegadores arrancan el audio en pausa hasta que el jugador toca algo.
  if (context.state === "suspended") void context.resume();
  return context;
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => audio(), { once: true });
}

export function playSound(name: Sound) {
  if (!isEnabled("sound")) return;
  const ctx = audio();
  const { wave, volume, notes, slideTo } = SOUNDS[name];
  for (const [frequency, start, duration] of notes) {
    const at = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, at);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + duration);
    // Entrada y salida rápidas para que no chasquee.
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }
}

export function vibrate(pattern: number | number[]) {
  if (isEnabled("vibration") && "vibrate" in navigator) navigator.vibrate(pattern);
}

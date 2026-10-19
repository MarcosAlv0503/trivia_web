"use client";

import { isEnabled } from "@/features/preferences/preferences";

// Efectos de sonido sintetizados con Web Audio (sin archivos): notas de mazo y campana (varios armónicos que se
// apagan a distinto ritmo), golpes de madera (ruido filtrado) y una reverberación corta generada. Y vibración
// (solo donde el navegador la admite: Android sí, iPhone no). Ambos se pueden apagar en el perfil.

export type Sound = "correct" | "fast" | "veryFast" | "wrong" | "timeout" | "tick" | "spin" | "win";

// Notas (Hz).
const C4 = 261.63,
  E4 = 329.63,
  G4 = 392,
  Bb3 = 233.08,
  Eb4 = 311.13;
const C5 = 523.25,
  E5 = 659.25,
  G5 = 783.99,
  C6 = 1046.5,
  E6 = 1318.5,
  G6 = 1568;

type Engine = { ctx: AudioContext; out: AudioNode; noise: AudioBuffer };
let engine: Engine | undefined;

function createEngine(): Engine {
  const ctx = new AudioContext({ latencyHint: "interactive" });
  // Compresor al final: varias notas a la vez no saturan.
  const compressor = ctx.createDynamicsCompressor();
  compressor.connect(ctx.destination);
  const out = ctx.createGain();
  out.gain.value = 0.55;
  out.connect(compressor);
  // Reverberación de sala pequeña: ruido con caída exponencial como respuesta al impulso.
  const reverb = ctx.createConvolver();
  const length = Math.floor(ctx.sampleRate * 1.2);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  reverb.buffer = impulse;
  const wet = ctx.createGain();
  wet.gain.value = 0.18;
  out.connect(reverb).connect(wet).connect(compressor);

  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  return { ctx, out, noise };
}

function getEngine() {
  engine ??= createEngine();
  // Los navegadores arrancan el audio en pausa hasta que el jugador toca algo.
  if (engine.ctx.state === "suspended") void engine.ctx.resume();
  return engine;
}

// Se prepara al cargar (arrancar el dispositivo de audio tarda) y se activa con el primer toque o tecla, para que
// el primer sonido salga a tiempo.
if (typeof window !== "undefined") {
  getEngine();
  for (const event of ["pointerdown", "keydown"]) {
    window.addEventListener(event, () => getEngine(), { once: true, capture: true });
  }
}

// Envolvente de percusión: ataque casi inmediato y caída exponencial.
function envelope({ ctx, out }: Engine, at: number, volume: number, decay: number) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  gain.connect(out);
  return gain;
}

/** Nota con armónicos [proporción, volumen relativo, caída relativa]. */
function tone(
  e: Engine,
  partials: number[][],
  freq: number,
  at: number,
  volume: number,
  decay: number,
) {
  for (const [ratio, amp, decayRatio] of partials) {
    const osc = e.ctx.createOscillator();
    osc.frequency.value = freq * ratio!;
    osc.connect(envelope(e, at, volume * amp!, decay * decayRatio!));
    osc.start(at);
    osc.stop(at + decay * decayRatio! + 0.05);
  }
}

// Marimba (cálida) y campana (brillante, para los destellos).
const MALLET = [
  [1, 1, 1],
  [3.99, 0.22, 0.3],
  [10.7, 0.05, 0.12],
];
const BELL = [
  [1, 1, 1],
  [2.01, 0.45, 0.7],
  [3.02, 0.25, 0.45],
  [4.24, 0.12, 0.3],
];

/** Golpe de madera: ruido filtrado muy corto. */
function knock(e: Engine, at: number, freq: number, volume: number, decay = 0.035) {
  const src = e.ctx.createBufferSource();
  src.buffer = e.noise;
  const filter = e.ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 6;
  src.connect(filter).connect(envelope(e, at, volume, decay));
  src.start(at);
  src.stop(at + decay + 0.05);
}

const SOUNDS: Record<Sound, (e: Engine, t: number) => void> = {
  correct: (e, t) => {
    tone(e, MALLET, G5, t, 0.32, 0.5);
    tone(e, MALLET, C6, t + 0.09, 0.32, 0.7);
  },
  fast: (e, t) => {
    [E5, G5, C6].forEach((f, i) => tone(e, MALLET, f, t + i * 0.07, 0.3, 0.6));
    tone(e, BELL, E6, t + 0.2, 0.08, 0.8);
  },
  veryFast: (e, t) => {
    [C5, E5, G5, C6].forEach((f, i) => tone(e, MALLET, f, t + i * 0.06, 0.3, 0.6));
    [E6, G6].forEach((f, i) => tone(e, BELL, f, t + 0.24 + i * 0.08, 0.1, 1.1));
  },
  wrong: (e, t) => {
    knock(e, t, 500, 0.25, 0.06);
    tone(e, MALLET, Eb4, t, 0.38, 0.35);
    tone(e, MALLET, Bb3, t + 0.13, 0.42, 0.55);
  },
  timeout: (e, t) => {
    [G4, E4, C4].forEach((f, i) => tone(e, MALLET, f, t + i * 0.14, 0.34, 0.5));
  },
  tick: (e, t) => {
    knock(e, t, 2600, 0.35);
    tone(e, MALLET, G6, t, 0.05, 0.06);
  },
  // Trinquete que se espacia como la ruleta al frenar (gira 3,2 s).
  spin: (e, t) => {
    for (let i = 0; i < 22; i++) knock(e, t + 3.1 * (i / 22) ** 1.8, 2200, 0.28, 0.025);
  },
  win: (e, t) => {
    [C5, E5, G5, C6].forEach((f, i) => tone(e, MALLET, f, t + i * 0.08, 0.28, 0.6));
    [C6, E6, G6].forEach((f) => tone(e, BELL, f, t + 0.34, 0.07, 1.6));
  },
};

export function playSound(name: Sound) {
  if (!isEnabled("sound")) return;
  const e = getEngine();
  SOUNDS[name](e, e.ctx.currentTime);
}

export function vibrate(pattern: number | number[]) {
  if (isEnabled("vibration") && "vibrate" in navigator) navigator.vibrate(pattern);
}

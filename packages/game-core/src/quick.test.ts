import { describe, expect, it } from "vitest";
import { phaseAfterReveal, rankPlayers, roundOf, seatOf } from "./quick";

describe("turnos", () => {
  it("alterna asientos y avanza la ronda cuando han jugado todos", () => {
    const turns = [0, 1, 2, 3, 4].map((p) => [seatOf(p, 3), roundOf(p, 3)]);
    expect(turns).toEqual([
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 2],
      [1, 2],
    ]);
  });

  it("en solitario cada posición es una ronda", () => {
    expect(seatOf(6, 1)).toBe(0);
    expect(roundOf(6, 1)).toBe(7);
  });
});

describe("phaseAfterReveal", () => {
  it("termina, pasa el dispositivo en local o sigue en solitario", () => {
    expect(phaseAfterReveal(true, 3)).toBe("results");
    expect(phaseAfterReveal(false, 3)).toBe("handoff");
    expect(phaseAfterReveal(false, 1)).toBe("question");
  });
});

describe("rankPlayers", () => {
  it("ordena por puntos y los empatados comparten puesto", () => {
    const ranked = rankPlayers([
      { name: "a", score: 300 },
      { name: "b", score: 900 },
      { name: "c", score: 300 },
      { name: "d", score: 100 },
    ]);
    expect(ranked.map((p) => [p.name, p.place])).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 2],
      ["d", 4],
    ]);
  });
});

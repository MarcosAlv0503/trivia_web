import { describe, expect, it } from "vitest";
import { LIVE } from "./live";
import { headToHeadOutcome, legendaryThreshold, localOutcome } from "./outcome";

describe("headToHeadOutcome", () => {
  it("manda el resultado del servidor, también al rendirse o caducar", () => {
    expect(headToHeadOutcome("win", 0, 50)).toBe("victory");
    expect(headToHeadOutcome("loss", 200, 50)).toBe("defeat");
  });

  it("el empate es legendario desde el umbral", () => {
    expect(headToHeadOutcome("draw", LIVE.legendaryDraw, LIVE.legendaryDraw)).toBe("legendaryDraw");
    expect(headToHeadOutcome("draw", LIVE.legendaryDraw - 1, LIVE.legendaryDraw)).toBe("draw");
  });
});

describe("legendaryThreshold", () => {
  it("5 puntos por pregunta de cada jugador", () => {
    expect([7, 9, 18].map(legendaryThreshold)).toEqual([35, 45, 90]);
  });
});

describe("localOutcome", () => {
  const p = (name: string, score: number) => ({ name, score });

  it("en solitario no hay animación", () => {
    expect(localOutcome([p("Ana", 70)], 35)).toBeNull();
  });

  it("victoria del primero", () => {
    expect(localOutcome([p("Ana", 40), p("Bea", 70), p("Coral", 10)], 35)).toEqual({
      kind: "victory",
      winners: [p("Bea", 70)],
    });
  });

  it("empate de quienes comparten el primer puesto, legendario o no", () => {
    expect(localOutcome([p("Ana", 40), p("Bea", 40), p("Coral", 10)], 35)).toEqual({
      kind: "legendaryDraw",
      winners: [p("Ana", 40), p("Bea", 40)],
    });
    expect(localOutcome([p("Ana", 20), p("Bea", 20)], 35)?.kind).toBe("draw");
  });
});

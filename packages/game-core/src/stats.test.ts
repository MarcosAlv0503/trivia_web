import { describe, expect, it } from "vitest";
import { categoryHighlights } from "./stats";

const stat = (id: string, answered: number, correct: number) => ({ id, answered, correct });

describe("categoryHighlights", () => {
  it("marca la mejor y la peor entre las que tienen al menos 10 respuestas", () => {
    expect(
      categoryHighlights([stat("a", 10, 9), stat("b", 20, 10), stat("c", 10, 2), stat("d", 9, 0)]),
    ).toEqual({ best: "a", worst: "c" });
  });

  it("con menos de dos categorías válidas no marca nada", () => {
    expect(categoryHighlights([stat("a", 10, 9), stat("b", 9, 0)])).toEqual({});
    expect(categoryHighlights([])).toEqual({});
  });

  it("no marca un extremo empatado (por fracción, no por % redondeado)", () => {
    expect(categoryHighlights([stat("a", 10, 5), stat("b", 20, 10)])).toEqual({});
    expect(categoryHighlights([stat("a", 30, 10), stat("b", 60, 20), stat("c", 10, 9)])).toEqual({
      best: "c",
    });
    expect(categoryHighlights([stat("a", 10, 9), stat("b", 20, 18), stat("c", 10, 1)])).toEqual({
      worst: "c",
    });
  });
});

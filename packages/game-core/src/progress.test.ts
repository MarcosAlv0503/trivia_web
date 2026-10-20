import { describe, expect, it } from "vitest";
import { levelProgress, titleLevel, xpForLevel } from "./progress";

describe("niveles", () => {
  it("cada nivel pide 100 XP más que el anterior", () => {
    expect([1, 2, 3, 10, 50].map(xpForLevel)).toEqual([0, 100, 300, 4500, 122500]);
  });

  it("sube justo al llegar al umbral", () => {
    expect(levelProgress(0)).toEqual({ level: 1, current: 0, needed: 100 });
    expect(levelProgress(99)).toEqual({ level: 1, current: 99, needed: 100 });
    expect(levelProgress(100)).toEqual({ level: 2, current: 0, needed: 200 });
    expect(levelProgress(4499).level).toBe(9);
    expect(levelProgress(4500)).toEqual({ level: 10, current: 0, needed: 1000 });
  });

  it("coincide con xpForLevel en todos los umbrales hasta el 300", () => {
    for (let level = 1; level <= 300; level++) {
      expect(levelProgress(xpForLevel(level)).level).toBe(level);
      expect(levelProgress(xpForLevel(level) - 1).level).toBe(Math.max(1, level - 1));
    }
  });
});

describe("títulos", () => {
  it("cambian cada 5 niveles y se quedan en el del 50", () => {
    expect([1, 4, 5, 9, 10, 49, 50, 51, 200].map(titleLevel)).toEqual([
      1, 1, 5, 5, 10, 45, 50, 50, 50,
    ]);
  });
});

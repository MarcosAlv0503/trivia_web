import { describe, expect, it } from "vitest";
import { levelCost, levelProgress, titleLevel, xpForLevel } from "./progress";

describe("niveles", () => {
  it("cada nivel cuesta un 13 % más que el anterior, empezando en 50 XP", () => {
    expect([1, 2, 3, 10].map(levelCost)).toEqual([50, 56, 64, 150]);
    expect([1, 2, 3, 5, 10, 20, 50].map(xpForLevel)).toEqual([0, 50, 106, 242, 771, 3538, 153031]);
  });

  it("sube justo al llegar al umbral", () => {
    expect(levelProgress(0)).toEqual({ level: 1, current: 0, needed: 50 });
    expect(levelProgress(49)).toEqual({ level: 1, current: 49, needed: 50 });
    expect(levelProgress(50)).toEqual({ level: 2, current: 0, needed: 56 });
    expect(levelProgress(770).level).toBe(9);
    expect(levelProgress(771)).toEqual({ level: 10, current: 0, needed: 150 });
  });

  it("coincide con xpForLevel en todos los umbrales hasta el 150", () => {
    for (let level = 1; level <= 150; level++) {
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

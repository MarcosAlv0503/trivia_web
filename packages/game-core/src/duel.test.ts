import { describe, expect, it } from "vitest";
import { duelPendingRound, hoursLeft } from "./duel";

describe("hoursLeft", () => {
  const now = new Date("2026-10-16T12:00:00Z");

  it("redondea hacia arriba las horas restantes", () => {
    expect(hoursLeft(new Date("2026-10-18T12:00:00Z"), now)).toBe(48);
    expect(hoursLeft(new Date("2026-10-16T12:00:01Z"), now)).toBe(1);
  });

  it("devuelve 0 si el plazo ya pasó", () => {
    expect(hoursLeft(new Date("2026-10-16T11:00:00Z"), now)).toBe(0);
  });
});

describe("duelPendingRound", () => {
  it("responde primero la ronda del rival y después la que gira", () => {
    expect(duelPendingRound(1, 1)).toBe(1);
    expect(duelPendingRound(2, 1)).toBe(1);
    expect(duelPendingRound(2, 2)).toBe(2);
    expect(duelPendingRound(7, 6)).toBe(6);
  });
});

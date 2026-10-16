import { describe, expect, it } from "vitest";
import { isValidUsername, randomUsername, usernameBaseFromMetadata } from "./username";

describe("isValidUsername", () => {
  it.each(["abc", "Ana_99", "a".repeat(20)])("acepta %s", (name) => {
    expect(isValidUsername(name)).toBe(true);
  });

  it.each(["ab", "a".repeat(21), "niño", "con espacio", "guion-medio", ""])(
    "rechaza %s",
    (name) => {
      expect(isValidUsername(name)).toBe(false);
    },
  );
});

describe("usernameBaseFromMetadata", () => {
  it("usa el alias del proveedor limpiando caracteres no permitidos", () => {
    expect(usernameBaseFromMetadata({ user_name: "José.Pérez" })).toBe("JosePerez");
    expect(usernameBaseFromMetadata({ preferred_username: "gamer_x" })).toBe("gamer_x");
  });

  it("recorta a 20 caracteres", () => {
    expect(usernameBaseFromMetadata({ user_name: "a".repeat(30) })).toBe("a".repeat(20));
  });

  it("no usa nombre real ni email", () => {
    expect(usernameBaseFromMetadata({ full_name: "Ana García", email: "ana@x.com" })).toBeNull();
  });

  it("devuelve null si el alias limpio es demasiado corto", () => {
    expect(usernameBaseFromMetadata({ user_name: "ñ." })).toBeNull();
    expect(usernameBaseFromMetadata(undefined)).toBeNull();
  });
});

describe("randomUsername", () => {
  it("genera un nombre válido con 4 dígitos", () => {
    expect(randomUsername(() => 0)).toBe("ajolote0000");
    expect(randomUsername(() => 0.99999)).toBe("ajolote9999");
    expect(isValidUsername(randomUsername())).toBe(true);
  });
});

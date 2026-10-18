// Genera un par de claves VAPID para los avisos push web (README > "Avisos push"). Uso: pnpm push:keys
// La pública va a la web (NEXT_PUBLIC_VAPID_PUBLIC_KEY) y a la Edge Function; la privada, solo a la función.
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pub = publicKey.export({ format: "jwk" });
// Clave pública sin comprimir (0x04 + x + y), en base64url: el formato que esperan los navegadores.
const raw = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(pub.x!, "base64url"),
  Buffer.from(pub.y!, "base64url"),
]);
console.log(`VAPID_PUBLIC_KEY=${raw.toString("base64url")}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey.export({ format: "jwk" }).d}`);

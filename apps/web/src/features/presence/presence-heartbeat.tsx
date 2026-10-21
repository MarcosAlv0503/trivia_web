"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Más corto que los 45 s tras los que el servidor da a alguien por desconectado.
const BEAT_MS = 20_000;
// Pantallas de una partida en curso: quien está en una sale como "Jugando" y no recibe retos en vivo.
const BUSY_PATH = /^\/(play\/quick|duel|live)\/[^/]+$/;

/** Latido de presencia mientras la pestaña está visible (al ocultarla, a los 45 s sale desconectado). */
export function PresenceHeartbeat() {
  const pathname = usePathname();
  const [supabase] = useState(createClient);

  useEffect(() => {
    const busy = BUSY_PATH.test(pathname);
    const beat = () => {
      if (document.visibilityState === "visible") {
        // La consulta solo se envía al esperarla (then).
        void supabase.rpc("touch_presence", { is_busy: busy }).then();
      }
    };
    beat();
    const id = setInterval(beat, BEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [pathname, supabase]);

  return null;
}

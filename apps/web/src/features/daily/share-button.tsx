"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/components/button";

type Props = { number: number; correct: number; total: number; points: number };

/**
 * Comparte la imagen del resultado (/daily/image) con una frase y el enlace. Con el menú de compartir del sistema si
 * admite archivos (móvil); si no, descarga la imagen y copia la frase.
 */
export function ShareButton({ number, correct, total, points }: Props) {
  const t = useTranslations("Daily");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  // La imagen se pide antes: Safari solo deja abrir el menú de compartir justo al tocar, sin esperas entre medias.
  useEffect(() => {
    let cancelled = false;
    fetch("/daily/image")
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        if (!cancelled) setFile(new File([blob], `reto-${number}.png`, { type: "image/png" }));
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [number]);

  async function share() {
    if (!file) return;
    const text = t("shareText", { number, correct, total, points, url: window.location.origin });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch (error) {
      // Cerrar el menú de compartir sin elegir nada no es un error.
      if ((error as Error).name !== "AbortError") setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void share()}
        disabled={!file}
        className={buttonClassName("play", "w-full")}
      >
        {t("share")}
      </button>
      {status !== "idle" && (
        <p
          role="status"
          className={`text-center font-bold ${status === "error" ? "text-ko" : "text-fg-muted"}`}
        >
          {t(status === "copied" ? "shareCopied" : "shareError")}
        </p>
      )}
    </div>
  );
}

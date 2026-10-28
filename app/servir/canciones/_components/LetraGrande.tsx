"use client";

import { useEffect, useState } from "react";
import type { Seccion } from "../_lib/canciones";
import { LetraSecciones } from "./ui";

const TAMANOS = [18, 22, 26, 32, 40];
const CLAVE = "servir.letra.tamano";

// Letra para leer en el celular: tamaño ajustable (recordado en este
// dispositivo) y pantalla encendida mientras está abierta.
export function LetraGrande({ secciones }: { secciones: Seccion[] }) {
  const [i, setI] = useState(2);

  useEffect(() => {
    try {
      const guardado = Number(localStorage.getItem(CLAVE));
      if (TAMANOS.includes(guardado)) setI(TAMANOS.indexOf(guardado));
    } catch {}
  }, []);

  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } };
    const pedir = () => nav.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {});
    pedir();
    const alVolver = () => document.visibilityState === "visible" && pedir();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      lock?.release().catch(() => {});
    };
  }, []);

  function cambiar(delta: number) {
    const n = Math.min(TAMANOS.length - 1, Math.max(0, i + delta));
    setI(n);
    try { localStorage.setItem(CLAVE, String(TAMANOS[n])); } catch {}
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="segmented self-end" role="group" aria-label="Tamaño de la letra">
        <button type="button" aria-label="Letra más pequeña" disabled={i === 0} onClick={() => cambiar(-1)} className="w-11">
          <span className="text-[12px]">A</span>
        </button>
        <button type="button" aria-label="Letra más grande" disabled={i === TAMANOS.length - 1} onClick={() => cambiar(1)} className="w-11">
          <span className="text-[17px]">A</span>
        </button>
      </div>
      <LetraSecciones secciones={secciones} tamano={TAMANOS[i]} />
    </div>
  );
}

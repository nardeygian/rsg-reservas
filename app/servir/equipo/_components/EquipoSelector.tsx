"use client";

import { useRouter } from "next/navigation";
import type { Equipo } from "../_lib/datos";

// Para quien tiene varios equipos a cargo (o Planeación, que ve todos).
export function EquipoSelector({ equipos, actual, vista }: { equipos: Equipo[]; actual: string; vista: string }) {
  const router = useRouter();
  if (equipos.length < 2) return null;
  return (
    <select
      className="input filter-select self-start w-auto max-w-full"
      aria-label="Equipo"
      value={actual}
      onChange={(e) => router.push(`/servir/equipo?equipo=${encodeURIComponent(e.target.value)}&vista=${vista}`)}
    >
      {equipos.map((e) => (
        <option key={e.key} value={e.key}>{e.area_name ? `${e.ministry_name} · ${e.area_name}` : e.ministry_name}</option>
      ))}
    </select>
  );
}

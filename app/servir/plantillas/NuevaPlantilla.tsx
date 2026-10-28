"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import { crearPlantilla } from "./actions";

export function NuevaPlantilla({ meetingTypeId, sugerido }: { meetingTypeId: string | null; sugerido: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(sugerido);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)}
        className="h-9 px-3 rounded-full text-[13px] font-semibold inline-flex items-center gap-1"
        style={{ background: "var(--color-surface-2)", color: "var(--color-ink)" }}>
        <Icon name="plus" size={14} />
        Nueva plantilla
      </button>
    );
  }

  return (
    <form className="flex flex-col gap-2 w-full"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await crearPlantilla({ meeting_type_id: meetingTypeId, name: nombre });
          if (!r.ok) return setError(r.error);
          router.push(`/servir/plantillas/${r.data.id}`);
        });
      }}>
      <div className="flex gap-2">
        <input aria-label="Nombre de la plantilla" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" autoFocus required />
        <button type="submit" className="btn-primary flex-none" disabled={pendiente}>Crear</button>
        <button type="button" className="icon-btn self-center" onClick={() => setAbierto(false)}>
          <Icon name="close" size={15} label="Cerrar" />
        </button>
      </div>
      {error && <p role="alert" className="text-[13px]" style={{ color: "var(--color-critical)" }}>{error}</p>}
    </form>
  );
}

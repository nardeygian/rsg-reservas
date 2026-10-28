"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { borrarCancion, restaurarCancion } from "../actions";

export function Archivar({ id, activa }: { id: string; activa: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>
        {activa
          ? "Archivar la quita de la biblioteca y del orden de nuevas reuniones. Las reuniones que ya la usaron la conservan."
          : "Esta canción está archivada: no aparece en la biblioteca ni al armar el orden."}
      </p>
      <button
        type="button"
        className="btn-secondary self-start"
        disabled={pendiente}
        style={activa ? { color: "var(--color-down)" } : undefined}
        onClick={() => {
          if (activa && !confirm("¿Archivar esta canción?")) return;
          setError(null);
          startTransition(async () => {
            const r = activa ? await borrarCancion(id) : await restaurarCancion(id);
            if (!r.ok) return setError(r.error);
            router.push(activa ? "/servir/canciones" : `/servir/canciones/${id}`);
            router.refresh();
          });
        }}
      >
        {pendiente ? "Guardando…" : activa ? "Archivar canción" : "Restaurar canción"}
      </button>
      {error && <p role="alert" className="text-[14px] font-semibold" style={{ color: "var(--color-down)" }}>{error}</p>}
    </div>
  );
}

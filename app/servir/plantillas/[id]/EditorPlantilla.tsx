"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ItemOrdenPlantilla } from "@/lib/servir/contratos";
import { EditorOrden } from "../../reuniones/_components/EditorOrden";
import { borrarPlantilla, guardarPlantilla, usarPorDefecto } from "../actions";

export function EditorPlantilla({
  plantilla, editable, canciones, tipo, esPorDefecto, espacios,
}: {
  plantilla: { id: string; name: string; version: number; run_sheet: ItemOrdenPlantilla[] };
  editable: boolean;
  canciones: { id: string; title: string }[];
  tipo: { id: string; name: string } | null;
  esPorDefecto: boolean;
  espacios?: ReactNode;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(plantilla.name);
  const [nuevaVersion, setNuevaVersion] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function correr(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, ok: () => void) {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error);
      ok();
    });
  }

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-start">
      <EditorOrden
        inicial={plantilla.run_sheet}
        editable={editable}
        canciones={canciones}
        cambiosExternos={nombre.trim() !== plantilla.name}
        textoGuardar={nuevaVersion ? `Guardar como v${plantilla.version + 1}` : "Guardar cambios"}
        onGuardar={editable ? async (items) => {
          const r = await guardarPlantilla(plantilla.id, { name: nombre, run_sheet: items, nuevaVersion });
          if (r.ok && r.data.id !== plantilla.id) router.push(`/servir/plantillas/${r.data.id}`);
          else if (r.ok) router.refresh();
          return r;
        } : undefined}
      />

      <div className="flex flex-col gap-5">
        <section className="card p-4 md:p-5 flex flex-col gap-3">
          <div>
            <label htmlFor="t-nombre" className="field-label block mb-1.5">Nombre</label>
            <input id="t-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={!editable} maxLength={120} />
          </div>
          {editable && (
            <label className="flex items-start gap-3 cursor-pointer text-[14px]">
              <input type="checkbox" className="mt-1 accent-[var(--color-accent)]" checked={nuevaVersion} onChange={(e) => setNuevaVersion(e.target.checked)} />
              <span>
                <span className="font-medium block">Guardar como nueva versión</span>
                <span className="text-xs block mt-0.5" style={{ color: "var(--color-faint)" }}>
                  La versión {plantilla.version} queda intacta. Las reuniones ya creadas no cambian en ningún caso.
                </span>
              </span>
            </label>
          )}
        </section>

        {espacios}

        {editable && tipo && (
          <section className="card p-4 md:p-5 flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold">{tipo.name}</h2>
            {esPorDefecto ? (
              <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>Es la plantilla por defecto de este tipo: las reuniones nuevas llegan con este orden.</p>
            ) : (
              <button type="button" className="btn-secondary self-start" disabled={pendiente}
                onClick={() => correr(() => usarPorDefecto(tipo.id, plantilla.id), () => { setAviso("Ahora es la plantilla por defecto."); router.refresh(); })}>
                Usar por defecto
              </button>
            )}
          </section>
        )}

        {editable && (
          <button type="button" className="btn-ghost self-start" disabled={pendiente} style={{ color: "var(--color-critical)" }}
            onClick={() => {
              if (!confirm(`¿Borrar ${plantilla.name} v${plantilla.version}? Las reuniones creadas con ella no cambian.`)) return;
              correr(() => borrarPlantilla(plantilla.id), () => router.push("/servir/plantillas"));
            }}>
            Borrar esta versión
          </button>
        )}

        {error && <p role="alert" className="text-[14px] font-medium" style={{ color: "var(--color-critical)" }}>{error}</p>}
        {aviso && <p role="status" className="text-[14px] font-medium" style={{ color: "var(--color-positive)" }}>{aviso}</p>}
      </div>
    </div>
  );
}

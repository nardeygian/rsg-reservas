"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  svGrupoCrearAction, svSeedDiscipuladosAction,
} from "@/app/servicio/actions";
import type { SvData, SvGrupo, SvMiembro } from "@/app/servicio/_lib/types";
import { GrupoSheet } from "@/app/servicio/_components/GrupoSheet";

export function DiscipuladosShell({ svData }: { svData: SvData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [showNuevoGrupo, setShowNuevoGrupo] = useState(false);
  const [nuevoGrupoErr, setNuevoGrupoErr]   = useState("");
  const [sheet, setSheet] = useState<{ gid: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function refresh(msg?: string) {
    startTransition(() => { router.refresh(); });
    if (msg) showToast(msg);
  }

  async function handleNuevoGrupo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setNuevoGrupoErr("");
    try {
      await svGrupoCrearAction(fd);
      setShowNuevoGrupo(false);
      refresh("Discipulado creado");
    } catch (err) {
      setNuevoGrupoErr((err as Error).message);
    }
  }

  async function handleSeedDiscipulados() {
    try {
      const { count } = await svSeedDiscipuladosAction();
      refresh(`${count} discípulos importados`);
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  const grupos = Object.values(svData.grupos ?? {}).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es")
  );
  const grupoActivo = sheet ? svData.grupos?.[sheet.gid] ?? null : null;
  const miembrosActivos: SvMiembro[] = sheet
    ? Object.values(svData.miembros ?? {}).filter((m) => m.grupo_id === sheet.gid)
    : [];

  return (
    <main className="min-h-dvh" style={{ background: "var(--color-bg)" }}>
      <div className="px-4 pt-6 pb-10 max-w-2xl mx-auto flex flex-col gap-5">

        <header className="flex flex-col gap-1">
          <span className="eyebrow">Administración</span>
          <h1 className="text-[26px] font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            Discipulados
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
            Grupos de discipulado, líderes y discípulos.
          </p>
        </header>

        <div className="rounded-[16px] overflow-hidden" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
          <div className="px-4 pt-4 pb-3 border-b flex items-center gap-3 flex-wrap" style={{ borderColor: "var(--color-line)" }}>
            <h2 className="font-bold text-base flex-1" style={{ color: "var(--color-ink)" }}>Discipulados</h2>
            <button
              type="button"
              className="text-xs font-semibold px-3 py-1.5 rounded-[8px]"
              style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}
              onClick={() => setShowNuevoGrupo(v => !v)}
            >
              Nuevo discipulado
            </button>
          </div>

          {showNuevoGrupo && (
            <form onSubmit={handleNuevoGrupo} className="flex items-end gap-2 flex-wrap px-4 py-3 border-b" style={{ borderColor: "var(--color-line)", background: "var(--color-bg)" }}>
              <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                <label className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>Nombre del discipulado</label>
                <input name="nombre" required placeholder="Ej. Discipulado Jóvenes" className="input text-sm" />
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
                <label className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>Líder</label>
                <input name="lider" placeholder="Nombre del líder" className="input text-sm" />
              </div>
              <button type="submit" className="btn-primary text-sm px-4 py-2">Crear</button>
              {nuevoGrupoErr && <p className="w-full text-xs" style={{ color: "var(--color-down)" }}>{nuevoGrupoErr}</p>}
            </form>
          )}

          {grupos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}>
                    <th className="text-left px-4 py-2 text-xs font-semibold">Discipulado</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold">Líder</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold">Discípulos</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map(g => {
                    const count = Object.values(svData.miembros ?? {}).filter(m => m.grupo_id === g.id).length;
                    return (
                      <tr key={g.id} className="border-t" style={{ borderColor: "var(--color-line)" }}>
                        <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--color-ink)" }}>{g.nombre}</td>
                        <td className="px-4 py-2.5" style={{ color: "var(--color-muted)" }}>{g.lider || "—"}</td>
                        <td className="px-4 py-2.5 text-right font-bold" style={{ color: "var(--color-ink)" }}>{count}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            className="text-xs font-semibold px-3 py-1.5 rounded-[8px]"
                            style={{ background: "var(--color-surface-2)", color: "var(--color-ink)", border: "1px solid var(--color-line)" }}
                            onClick={() => setSheet({ gid: g.id })}
                          >
                            Gestionar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-8 flex flex-col items-center gap-3 text-sm" style={{ color: "var(--color-muted)" }}>
              <span>Aún no hay discipulados. Crea el primero arriba.</span>
              <button
                type="button"
                className="text-xs font-semibold px-3 py-1.5 rounded-[8px]"
                style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-text)", border: "1px solid var(--color-gold)" }}
                onClick={handleSeedDiscipulados}
                disabled={pending}
              >
                Importar grupos desde resurgencia-web
              </button>
            </div>
          )}
        </div>

      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-[10px] text-sm font-semibold shadow-lg"
          style={{ background: "var(--color-ink)", color: "var(--color-bg)", whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      {sheet && grupoActivo && (
        <GrupoSheet
          grupo={grupoActivo}
          miembros={miembrosActivos}
          onClose={() => setSheet(null)}
          onSaved={(msg) => { setSheet(null); refresh(msg); }}
        />
      )}
    </main>
  );
}

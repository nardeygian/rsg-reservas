"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import { archivarReuniones, eliminarReuniones } from "../actions";
import { horaBogota } from "../_lib/fechas";
import { EstadoChip, PuntoColor } from "./ui";

export type FilaLista = {
  id: string; name: string; meeting_date: string; starts_at: string | null; status: string;
  tipo: string | null; color: string | null;
  archivada: boolean;
  puedeBorrar: boolean;   // la base vuelve a decidirlo (pasadas: solo super admin)
};

const ANCHO_ACCIONES = 228;   // lo que se abre al deslizar

function etiquetaMes(fecha: string): string {
  const s = new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Lista de reuniones: tocar abre la reunión; deslizar a la izquierda muestra
// Editar, Archivar y Eliminar; "Seleccionar" permite archivar o eliminar
// varias a la vez.
export function ListaReuniones({ proximas, anteriores, puedeEditar, vacio }: {
  proximas: FilaLista[]; anteriores: FilaLista[]; puedeEditar: boolean; vacio: string;
}) {
  const router = useRouter();
  const [seleccionando, setSeleccionando] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [abierta, setAbierta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, start] = useTransition();

  const todas = [...proximas, ...anteriores];
  const elegidas = todas.filter((f) => sel.has(f.id));
  const todasArchivadas = elegidas.length > 0 && elegidas.every((f) => f.archivada);

  function salir() { setSeleccionando(false); setSel(new Set()); }
  function alternar(id: string) {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSel(n);
  }

  function archivar(ids: string[], archivarlas: boolean) {
    setAviso(null);
    start(async () => {
      const r = await archivarReuniones(ids, archivarlas);
      if (!r.ok) return setAviso({ ok: false, texto: r.error });
      const verbo = archivarlas ? "archivada" : "restaurada";
      setAviso({ ok: r.data.no === 0, texto: `${r.data.hechas} ${r.data.hechas === 1 ? verbo : `${verbo}s`}${r.data.no ? `; ${r.data.no} sin permiso` : ""}.` });
      salir(); setAbierta(null); router.refresh();
    });
  }

  function eliminar(ids: string[]) {
    const n = ids.length;
    if (!confirm(n === 1 ? "¿Eliminar esta reunión? Se borra con su orden, equipo e historial. No se puede deshacer." : `¿Eliminar ${n} reuniones? Se borran con su orden, equipo e historial. No se puede deshacer.`)) return;
    setAviso(null);
    start(async () => {
      const r = await eliminarReuniones(ids);
      if (!r.ok) return setAviso({ ok: false, texto: r.error });
      setAviso({
        ok: r.data.no === 0,
        texto: `${r.data.hechas} ${r.data.hechas === 1 ? "eliminada" : "eliminadas"}${r.data.no ? `; ${r.data.no} no (las que ya pasaron solo las borra un super admin)` : ""}.`,
      });
      salir(); setAbierta(null); router.refresh();
    });
  }

  const props = { seleccionando, sel, alternar, abierta, setAbierta, puedeEditar, archivar, eliminar, pendiente };

  return (
    <div className="flex flex-col gap-4">
      {puedeEditar && todas.length > 0 && (
        <div className="flex items-center gap-2 self-end -mb-2">
          {seleccionando ? (
            <>
              <button type="button" className="btn-ghost min-h-[36px] px-3 text-[14px]"
                onClick={() => setSel(sel.size === todas.length ? new Set() : new Set(todas.map((f) => f.id)))}>
                {sel.size === todas.length ? "Ninguna" : "Todas"}
              </button>
              <button type="button" className="btn-secondary min-h-[36px] px-3 text-[14px]" onClick={salir}>Listo</button>
            </>
          ) : (
            <button type="button" className="btn-secondary min-h-[36px] px-3 text-[14px]" onClick={() => { setSeleccionando(true); setAbierta(null); }}>
              Seleccionar
            </button>
          )}
        </div>
      )}
      {aviso && (
        <p role="status" className="text-[14px] font-medium px-1" style={{ color: aviso.ok ? "var(--color-positive)" : "var(--color-critical)" }}>{aviso.texto}</p>
      )}

      <section className="card p-2 md:p-4 flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold px-3 pt-2">Próximas</h2>
        {proximas.length === 0
          ? <p className="text-[14px] px-3 pb-4" style={{ color: "var(--color-muted)" }}>{vacio}</p>
          : <PorMes filas={proximas} {...props} />}
      </section>

      {anteriores.length > 0 && (
        <details className="card p-2 md:p-4 group" open={seleccionando || undefined}>
          <summary className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer list-none">
            <span className="text-[17px] font-semibold">Anteriores</span>
            <span className="inline-flex items-center gap-2 text-[14px]" style={{ color: "var(--color-muted)" }}>
              {anteriores.length}{anteriores.length >= 150 ? "+" : ""}
              <Icon name="chevron-down" size={16} className="transition group-open:rotate-180" />
            </span>
          </summary>
          <div className="pt-2"><PorMes filas={anteriores} {...props} /></div>
        </details>
      )}

      {seleccionando && (
        <div className="fixed left-0 right-0 z-30 px-4" style={{ bottom: "calc(var(--nav-space) + 8px)" }}>
          <div className="card max-w-md md:max-w-[640px] mx-auto px-4 py-3 flex items-center gap-2 shadow-lg">
            <span className="flex-1 text-[14px] font-semibold tabular">{sel.size} {sel.size === 1 ? "seleccionada" : "seleccionadas"}</span>
            <button type="button" className="btn-secondary min-h-[40px] px-3 text-[14px]" aria-busy={pendiente} disabled={pendiente || sel.size === 0}
              onClick={() => archivar([...sel], !todasArchivadas)}>
              {todasArchivadas ? "Restaurar" : "Archivar"}
            </button>
            <button type="button" className="btn-secondary min-h-[40px] px-3 text-[14px]" aria-busy={pendiente} disabled={pendiente || sel.size === 0}
              style={{ color: "var(--color-critical)", borderColor: "var(--color-critical)" }} onClick={() => eliminar([...sel])}>
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type PropsFila = {
  seleccionando: boolean; sel: Set<string>; alternar: (id: string) => void;
  abierta: string | null; setAbierta: (id: string | null) => void;
  puedeEditar: boolean; archivar: (ids: string[], a: boolean) => void; eliminar: (ids: string[]) => void; pendiente: boolean;
};

function PorMes({ filas, ...p }: { filas: FilaLista[] } & PropsFila) {
  const grupos: { mes: string; filas: FilaLista[] }[] = [];
  for (const r of filas) {
    const mes = etiquetaMes(r.meeting_date);
    if (grupos.at(-1)?.mes !== mes) grupos.push({ mes, filas: [] });
    grupos.at(-1)!.filas.push(r);
  }
  return (
    <div className="flex flex-col gap-4">
      {grupos.map((g) => (
        <div key={g.mes} className="flex flex-col gap-1">
          <h3 className="eyebrow px-3">{g.mes}</h3>
          <ul className="flex flex-col">
            {g.filas.map((r) => <Fila key={r.id} r={r} {...p} />)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Fila({ r, seleccionando, sel, alternar, abierta, setAbierta, puedeEditar, archivar, eliminar, pendiente }: { r: FilaLista } & PropsFila) {
  const d = new Date(`${r.meeting_date}T12:00:00Z`);
  const dia = d.toLocaleDateString("es-CO", { day: "numeric", timeZone: "UTC" });
  const semana = d.toLocaleDateString("es-CO", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  const [arrastre, setArrastre] = useState<number | null>(null);
  const inicio = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const abiertaEsta = abierta === r.id;
  const deslizable = puedeEditar && !seleccionando;
  const desplazamiento = arrastre ?? (abiertaEsta ? -ANCHO_ACCIONES : 0);

  const contenido = (
    <>
      {seleccionando && (
        <span className="flex-none w-6 h-6 rounded-full grid place-items-center"
          style={{ border: "2px solid var(--color-line-strong)", background: sel.has(r.id) ? "var(--color-action-bg)" : "transparent", color: "var(--color-action-fg)" }}>
          {sel.has(r.id) && <Icon name="check" size={14} />}
        </span>
      )}
      <div className="w-11 flex-none flex flex-col items-center leading-none">
        <span className="text-[11px] uppercase font-semibold" style={{ color: "var(--color-muted)" }}>{semana}</span>
        <span className="text-[20px] font-semibold tabular mt-0.5">{dia}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold truncate" style={{ textDecoration: r.status === "cancelada" ? "line-through" : undefined }}>{r.name}</p>
        <p className="text-[13px] flex items-center gap-1.5 min-w-0" style={{ color: "var(--color-muted)" }}>
          <PuntoColor color={r.color} size={8} />
          <span className="truncate">{r.tipo ?? "Sin tipo"}</span>
          {r.starts_at && <span className="tabular flex-none">· {horaBogota(r.starts_at)}</span>}
        </p>
      </div>
      {r.archivada ? <span className="chip chip-muted flex-none">Archivada</span> : <EstadoChip status={r.status} />}
      {!seleccionando && <Icon name="chevron-right" size={16} className="hidden md:block" style={{ color: "var(--color-faint)" }} />}
    </>
  );
  const clases = "flex items-center gap-3 px-3 py-3 rounded-[var(--radius-control)] transition-colors hover:bg-[var(--color-surface-2)]";

  return (
    <li className="relative overflow-hidden rounded-[var(--radius-control)]">
      {/* Solo mientras se desliza o está abierta: la superficie de la tarjeta
          es translúcida y las acciones se verían detrás de la fila. */}
      {deslizable && desplazamiento < 0 && (
        <div className="absolute inset-y-0 right-0 flex items-stretch" style={{ width: ANCHO_ACCIONES }} aria-hidden={!abiertaEsta}>
          <Link href={`/servir/reuniones/${r.id}`} className="flex-1 grid place-items-center text-[13px] font-semibold"
            style={{ background: "var(--color-surface-2)", color: "var(--color-ink)" }} tabIndex={abiertaEsta ? 0 : -1}>
            Editar
          </Link>
          <button type="button" className="flex-1 text-[13px] font-semibold" aria-busy={pendiente} disabled={pendiente} tabIndex={abiertaEsta ? 0 : -1}
            style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-text)" }} onClick={() => archivar([r.id], !r.archivada)}>
            {r.archivada ? "Restaurar" : "Archivar"}
          </button>
          {r.puedeBorrar && (
            <button type="button" className="flex-1 text-[13px] font-semibold" aria-busy={pendiente} disabled={pendiente} tabIndex={abiertaEsta ? 0 : -1}
              style={{ background: "var(--color-critical)", color: "#F6F5F1" }} onClick={() => eliminar([r.id])}>
              Eliminar
            </button>
          )}
        </div>
      )}
      <div
        className="relative"
        style={{
          transform: `translateX(${desplazamiento}px)`,
          transition: arrastre === null ? "transform 200ms ease" : "none",
          background: desplazamiento < 0 ? "var(--color-surface-solid)" : undefined,
          opacity: desplazamiento === 0 && (r.status === "cancelada" || r.archivada) ? 0.65 : 1,
          touchAction: "pan-y",
        }}
        onTouchStart={deslizable ? (e) => { inicio.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, horizontal: null }; } : undefined}
        onTouchMove={deslizable ? (e) => {
          const i = inicio.current;
          if (!i) return;
          const dx = e.touches[0].clientX - i.x;
          const dy = e.touches[0].clientY - i.y;
          if (i.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) i.horizontal = Math.abs(dx) > Math.abs(dy);
          if (!i.horizontal) return;
          const base = abiertaEsta ? -ANCHO_ACCIONES : 0;
          setArrastre(Math.max(-ANCHO_ACCIONES - 24, Math.min(0, base + dx)));
        } : undefined}
        onTouchEnd={deslizable ? () => {
          const i = inicio.current;
          inicio.current = null;
          if (arrastre === null || !i?.horizontal) { setArrastre(null); return; }
          setAbierta(arrastre < -ANCHO_ACCIONES / 3 ? r.id : null);
          setArrastre(null);
        } : undefined}
      >
        {seleccionando ? (
          <button type="button" className={`${clases} w-full text-left`} onClick={() => alternar(r.id)} aria-pressed={sel.has(r.id)}>{contenido}</button>
        ) : (
          <Link href={`/servir/reuniones/${r.id}`} className={clases}
            onClick={(e) => { if (abiertaEsta || abierta) { e.preventDefault(); setAbierta(null); } }}>
            {contenido}
          </Link>
        )}
      </div>
    </li>
  );
}

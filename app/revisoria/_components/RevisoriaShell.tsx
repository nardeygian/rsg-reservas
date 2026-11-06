"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import { money, moneyShort } from "@/app/donaciones/_lib/don-logic";
import {
  aplicarFiltros, agruparPorDonante, desglosar, serieTemporal, filtrosAParams,
  diaBogota, horaBogota, hoyBogotaYMD, etiquetaMetodo, SIN_DATO,
  type TxFiscal, type FiltrosFiscales, type Desglose, type Donante,
} from "../_lib/fiscal-logic";

// ── Estilos compartidos ─────────────────────────────────────────────────────

const card = { background: "var(--color-surface)", border: "1px solid var(--color-line)" } as const;
const CARD = "rounded-[var(--radius-card)]";
const pct = (v: number, total: number) => (total > 0 ? (v / total) * 100 : 0);
const fmtPct = (v: number) => v.toFixed(1).replace(".", ",") + " %";
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function fmtDia(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)} ${y}`;
}

// ── Atajos de periodo ───────────────────────────────────────────────────────

type Atajo = { id: string; label: string; rango: () => { desde?: string; hasta?: string } };

function ymd(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m, d));
  return dt.toISOString().slice(0, 10);
}

const ATAJOS: Atajo[] = [
  { id: "mes", label: "Este mes", rango: () => { const [y, m] = hoyBogotaYMD().split("-").map(Number); return { desde: ymd(y, m - 1, 1), hasta: hoyBogotaYMD() }; } },
  { id: "mes-ant", label: "Mes anterior", rango: () => { const [y, m] = hoyBogotaYMD().split("-").map(Number); return { desde: ymd(y, m - 2, 1), hasta: ymd(y, m - 1, 0) }; } },
  { id: "trim", label: "Este trimestre", rango: () => { const [y, m] = hoyBogotaYMD().split("-").map(Number); const q = Math.floor((m - 1) / 3) * 3; return { desde: ymd(y, q, 1), hasta: hoyBogotaYMD() }; } },
  { id: "anio", label: "Este año", rango: () => { const y = Number(hoyBogotaYMD().slice(0, 4)); return { desde: `${y}-01-01`, hasta: hoyBogotaYMD() }; } },
  { id: "anio-ant", label: "Año anterior", rango: () => { const y = Number(hoyBogotaYMD().slice(0, 4)) - 1; return { desde: `${y}-01-01`, hasta: `${y}-12-31` }; } },
  { id: "todo", label: "Todo", rango: () => ({}) },
];

// ── Componente principal ────────────────────────────────────────────────────

export function RevisoriaShell({
  transacciones,
  filtrosIniciales,
}: {
  transacciones: TxFiscal[];
  filtrosIniciales: FiltrosFiscales;
}) {
  const [f, setF] = useState<FiltrosFiscales>(() =>
    Object.keys(filtrosIniciales).length > 0 ? filtrosIniciales : ATAJOS[3].rango(),
  );

  // Los filtros viven en la URL: se puede guardar o compartir el enlace.
  useEffect(() => {
    const qs = filtrosAParams(f).toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [f]);

  const set = (patch: Partial<FiltrosFiscales>) => setF((prev) => {
    const next = { ...prev, ...patch };
    for (const k of Object.keys(next) as (keyof FiltrosFiscales)[]) if (!next[k]) delete next[k];
    return next;
  });

  // Opciones de los filtros: todas las que existen en los datos.
  const opciones = useMemo(() => ({
    metodo: desglosar(transacciones, "metodo_pago"),
    concepto: desglosar(transacciones, "concepto"),
    origen: desglosar(transacciones, "origen"),
  }), [transacciones]);

  const filtradas = useMemo(() => aplicarFiltros(transacciones, f), [transacciones, f]);
  const total = useMemo(() => filtradas.reduce((s, t) => s + t.monto, 0), [filtradas]);
  const donantes = useMemo(() => agruparPorDonante(filtradas), [filtradas]);

  const primeraFecha = transacciones.length ? diaBogota(transacciones[transacciones.length - 1].fecha) : hoyBogotaYMD();
  const desdeEf = f.desde ?? primeraFecha;
  const hastaEf = f.hasta ?? hoyBogotaYMD();
  const { serie, unidad } = useMemo(() => serieTemporal(filtradas, desdeEf, hastaEf), [filtradas, desdeEf, hastaEf]);

  const porMetodo = useMemo(() => desglosar(filtradas, "metodo_pago"), [filtradas]);
  const porConcepto = useMemo(() => desglosar(filtradas, "concepto"), [filtradas]);
  const porOrigen = useMemo(() => desglosar(filtradas, "origen"), [filtradas]);

  const atajoActivo = ATAJOS.find((a) => {
    const r = a.rango();
    return r.desde === f.desde && r.hasta === f.hasta;
  })?.id;

  const qsExport = filtrosAParams(f);
  const hrefExport = (formato: "csv" | "xlsx") => {
    const p = new URLSearchParams(qsExport);
    p.set("formato", formato);
    return `/revisoria/exportar?${p.toString()}`;
  };

  const hayFiltrosExtra = !!(f.metodo || f.concepto || f.origen || f.q);

  return (
    <div className="px-4 md:px-8 pt-5 pb-28 md:pb-12 max-w-6xl mx-auto w-full flex flex-col gap-4">
      {/* Encabezado */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <p className="eyebrow">Revisoría fiscal</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" style={{ color: "var(--color-ink)" }}>Donaciones</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-muted)" }}>
            {f.desde || f.hasta ? `${fmtDia(desdeEf)} – ${fmtDia(hastaEf)}` : "Todo el historial"}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={hrefExport("csv")} className="btn-secondary flex-1 md:flex-none text-center" download>
            Descargar CSV
          </a>
          <a href={hrefExport("xlsx")} className="btn-primary flex-1 md:flex-none text-center" download>
            Descargar Excel
          </a>
        </div>
      </header>

      {/* Filtros */}
      <section className={`${CARD} p-4 flex flex-col gap-3`} style={card}>
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {ATAJOS.map((a) => {
            const on = a.id === atajoActivo || (a.id === "todo" && !f.desde && !f.hasta);
            return (
              <button key={a.id} type="button"
                onClick={() => setF((prev) => {
                  const next: FiltrosFiscales = { ...prev, ...a.rango() };
                  if (a.id === "todo") { delete next.desde; delete next.hasta; }
                  return next;
                })}
                className="text-sm font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition"
                style={on
                  ? { background: "var(--color-action-bg)", color: "var(--color-action-fg)" }
                  : { background: "var(--color-surface-2)", color: "var(--color-ink)" }}>
                {a.label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <Campo label="Desde">
            <input type="date" className="input" value={f.desde ?? ""} max={f.hasta}
              onChange={(e) => set({ desde: e.target.value || undefined })} />
          </Campo>
          <Campo label="Hasta">
            <input type="date" className="input" value={f.hasta ?? ""} min={f.desde}
              onChange={(e) => set({ hasta: e.target.value || undefined })} />
          </Campo>
          <Campo label="Medio de pago">
            <select className="input" value={f.metodo ?? ""} onChange={(e) => set({ metodo: e.target.value || undefined })}>
              <option value="">Todos</option>
              {opciones.metodo.map((o) => <option key={o.clave} value={o.clave}>{o.etiqueta}</option>)}
            </select>
          </Campo>
          <Campo label="Concepto">
            <select className="input" value={f.concepto ?? ""} onChange={(e) => set({ concepto: e.target.value || undefined })}>
              <option value="">Todos</option>
              {opciones.concepto.map((o) => <option key={o.clave} value={o.clave}>{o.etiqueta}</option>)}
            </select>
          </Campo>
          <Campo label="Origen">
            <select className="input" value={f.origen ?? ""} onChange={(e) => set({ origen: e.target.value || undefined })}>
              <option value="">Todos</option>
              {opciones.origen.map((o) => <option key={o.clave} value={o.clave}>{o.etiqueta}</option>)}
            </select>
          </Campo>
          <Campo label="Buscar">
            <input type="search" className="input" placeholder="Nombre, cédula, referencia"
              value={f.q ?? ""} onChange={(e) => set({ q: e.target.value || undefined })} />
          </Campo>
        </div>
        {hayFiltrosExtra && (
          <button type="button" className="self-start text-sm font-medium underline underline-offset-4"
            style={{ color: "var(--color-muted)" }}
            onClick={() => set({ metodo: undefined, concepto: undefined, origen: undefined, q: undefined })}>
            Quitar filtros de medio, concepto, origen y búsqueda
          </button>
        )}
      </section>

      {/* Indicadores */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total recaudado" valor={money(total)} />
        <Kpi label="Transacciones" valor={filtradas.length.toLocaleString("es-CO")} />
        <Kpi label="Donantes" valor={donantes.length.toLocaleString("es-CO")} />
        <Kpi label="Promedio por transacción" valor={money(filtradas.length ? total / filtradas.length : 0)} />
      </section>

      {filtradas.length === 0 ? (
        <div className={`${CARD} p-8 text-center text-sm`} style={{ ...card, color: "var(--color-muted)" }}>
          No hay donaciones con estos filtros.
        </div>
      ) : (
        <>
          <Grafica serie={serie} unidad={unidad} />

          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <TarjetaDesglose titulo="Por medio de pago" filas={porMetodo} total={total}
              activo={f.metodo} onElegir={(c) => set({ metodo: f.metodo === c ? undefined : c })} />
            <TarjetaDesglose titulo="Por concepto" filas={porConcepto} total={total}
              activo={f.concepto} onElegir={(c) => set({ concepto: f.concepto === c ? undefined : c })} />
            <TarjetaDesglose titulo="Por origen" filas={porOrigen} total={total}
              activo={f.origen} onElegir={(c) => set({ origen: f.origen === c ? undefined : c })} />
          </section>

          <TablaDonantes donantes={donantes} total={total} />
        </>
      )}

      <p className="text-xs text-center" style={{ color: "var(--color-faint)" }}>
        Horas en hora de Colombia. Las descargas traen una fila por transacción, en orden de fecha, con los filtros que tengas puestos.
      </p>
    </div>
  );
}

// ── Piezas ──────────────────────────────────────────────────────────────────

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}

function Kpi({ label, valor }: { label: string; valor: string }) {
  return (
    <div className={`${CARD} p-4 flex flex-col gap-1 min-w-0`} style={card}>
      <span className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>{label}</span>
      <span className="text-lg md:text-2xl font-semibold tabular-nums truncate" style={{ color: "var(--color-ink)" }}>{valor}</span>
    </div>
  );
}

function Grafica({ serie, unidad }: { serie: { clave: string; etiqueta: string; total: number; n: number }[]; unidad: "día" | "mes" }) {
  const max = Math.max(1, ...serie.map((s) => s.total));
  const cadaCuanto = Math.max(1, Math.ceil(serie.length / 12));
  return (
    <section className={`${CARD} p-4 flex flex-col gap-3`} style={card}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>Recaudo por {unidad}</h2>
        <span className="text-xs" style={{ color: "var(--color-faint)" }}>Máximo {moneyShort(max)}</span>
      </div>
      <div className="flex items-end gap-[2px] h-44" role="img" aria-label={`Recaudo por ${unidad}`}>
        {serie.map((s) => (
          <div key={s.clave} className="flex-1 h-full flex flex-col justify-end min-w-0 group relative">
            <div className="w-full rounded-t-[4px] transition-opacity group-hover:opacity-80"
              style={{ height: `${Math.max(s.total > 0 ? 2 : 0, pct(s.total, max))}%`, background: "var(--color-accent)" }}
              title={`${s.etiqueta}: ${money(s.total)} · ${s.n} transacciones`} />
          </div>
        ))}
      </div>
      <div className="flex gap-[2px]">
        {serie.map((s, i) => (
          <span key={s.clave} className="flex-1 min-w-0 text-[10px] text-center overflow-visible whitespace-nowrap"
            style={{ color: "var(--color-faint)" }}>
            {i % cadaCuanto === 0 ? s.etiqueta : ""}
          </span>
        ))}
      </div>
    </section>
  );
}

function TarjetaDesglose({
  titulo, filas, total, activo, onElegir,
}: {
  titulo: string; filas: Desglose[]; total: number; activo?: string; onElegir: (clave: string) => void;
}) {
  return (
    <div className={`${CARD} p-4 flex flex-col gap-3`} style={card}>
      <h2 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>{titulo}</h2>
      <ul className="flex flex-col gap-2.5">
        {filas.map((d) => {
          const p = pct(d.total, total);
          const on = activo === d.clave;
          return (
            <li key={d.clave}>
              <button type="button" onClick={() => onElegir(d.clave)}
                className="w-full text-left flex flex-col gap-1 rounded-[var(--radius-control)] -mx-1 px-1 py-0.5 transition"
                style={on ? { background: "var(--color-accent-soft)" } : undefined}
                aria-pressed={on}>
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate" style={{ color: d.clave === SIN_DATO ? "var(--color-faint)" : "var(--color-ink)" }}>{d.etiqueta}</span>
                  <span className="tabular-nums font-medium whitespace-nowrap" style={{ color: "var(--color-ink)" }}>{money(d.total)}</span>
                </span>
                <span className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
                  <span className="block h-full rounded-full" style={{ width: `${p}%`, background: "var(--color-accent)" }} />
                </span>
                <span className="text-xs tabular-nums" style={{ color: "var(--color-faint)" }}>
                  {fmtPct(p)} · {d.n.toLocaleString("es-CO")} {d.n === 1 ? "transacción" : "transacciones"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Orden = "total" | "nombre" | "n" | "ultima";

function TablaDonantes({ donantes, total }: { donantes: Donante[]; total: number }) {
  const [orden, setOrden] = useState<Orden>("total");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [limite, setLimite] = useState(50);

  const ordenados = useMemo(() => {
    const l = [...donantes];
    if (orden === "nombre") l.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    else if (orden === "n") l.sort((a, b) => b.n - a.n || b.total - a.total);
    else if (orden === "ultima") l.sort((a, b) => b.ultima.localeCompare(a.ultima));
    else l.sort((a, b) => b.total - a.total);
    return l;
  }, [donantes, orden]);

  const visibles = ordenados.slice(0, limite);

  return (
    <section className={`${CARD} flex flex-col`} style={card}>
      <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>Por donante</h2>
          <p className="text-xs" style={{ color: "var(--color-faint)" }}>Toca una persona para ver cada transacción.</p>
        </div>
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--color-muted)" }}>
          Ordenar por
          <select className="input !w-auto" value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
            <option value="total">Mayor total</option>
            <option value="n">Más transacciones</option>
            <option value="ultima">Más reciente</option>
            <option value="nombre">Nombre</option>
          </select>
        </label>
      </div>

      {/* Encabezado de columnas (escritorio) */}
      <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_90px_130px_150px_24px] gap-3 px-4 py-2 text-xs font-medium"
        style={{ color: "var(--color-faint)", borderTop: "1px solid var(--color-line)" }}>
        <span>Donante</span><span>Documento / email</span><span className="text-right">Transacc.</span>
        <span className="text-right">Última</span><span className="text-right">Total</span><span />
      </div>

      <ul>
        {visibles.map((d) => {
          const open = abierto === d.clave;
          return (
            <li key={d.clave} style={{ borderTop: "1px solid var(--color-line)" }}>
              <button type="button" onClick={() => setAbierto(open ? null : d.clave)} aria-expanded={open}
                className="w-full text-left px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto_20px] md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_90px_130px_150px_24px] gap-x-3 gap-y-0.5 items-center">
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate" style={{ color: "var(--color-ink)" }}>{d.nombre}</span>
                  <span className="md:hidden block text-xs truncate" style={{ color: "var(--color-faint)" }}>
                    {d.n} {d.n === 1 ? "transacción" : "transacciones"} · {fmtPct(pct(d.total, total))}
                  </span>
                </span>
                <span className="hidden md:block min-w-0 text-xs truncate" style={{ color: "var(--color-muted)" }}>
                  {[d.documentos[0], d.emails[0]].filter(Boolean).join(" · ") || "—"}
                </span>
                <span className="hidden md:block text-sm text-right tabular-nums" style={{ color: "var(--color-muted)" }}>{d.n}</span>
                <span className="hidden md:block text-sm text-right tabular-nums" style={{ color: "var(--color-muted)" }}>
                  {d.ultima ? fmtDia(diaBogota(d.ultima)) : "—"}
                </span>
                <span className="text-sm text-right font-semibold tabular-nums" style={{ color: "var(--color-ink)" }}>{money(d.total)}</span>
                <span style={{ color: "var(--color-faint)" }}><Icon name={open ? "chevron-up" : "chevron-down"} size={18} /></span>
              </button>
              {open && <DetalleDonante d={d} />}
            </li>
          );
        })}
      </ul>

      {ordenados.length > limite && (
        <button type="button" className="m-4 btn-secondary" onClick={() => setLimite((l) => l + 100)}>
          Ver más donantes ({(ordenados.length - limite).toLocaleString("es-CO")} restantes)
        </button>
      )}
    </section>
  );
}

function DetalleDonante({ d }: { d: Donante }) {
  return (
    <div className="px-4 pb-4 flex flex-col gap-3">
      <dl className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        <Dato k="Documento" v={d.documentos.join(", ") || "Sin dato"} />
        <Dato k="Email" v={d.emails.join(", ") || "Sin dato"} />
        <Dato k="Primera y última" v={`${fmtDia(diaBogota(d.primera))} – ${fmtDia(diaBogota(d.ultima))}`} />
      </dl>
      <div className="overflow-x-auto rounded-[var(--radius-control)]" style={{ border: "1px solid var(--color-line)" }}>
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}>
              <th className="text-left font-medium px-3 py-2">Fecha</th>
              <th className="text-right font-medium px-3 py-2">Monto</th>
              <th className="text-left font-medium px-3 py-2">Medio de pago</th>
              <th className="text-left font-medium px-3 py-2">Concepto</th>
              <th className="text-left font-medium px-3 py-2">Origen</th>
              <th className="text-left font-medium px-3 py-2">Referencia</th>
            </tr>
          </thead>
          <tbody>
            {d.transacciones.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--color-line)", color: "var(--color-ink)" }}>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">{fmtDia(diaBogota(t.fecha))} · {horaBogota(t.fecha)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">{money(t.monto)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{etiquetaMetodo(t.metodo_pago)}</td>
                <td className="px-3 py-2">{t.concepto ?? "—"}</td>
                <td className="px-3 py-2">{t.origen ?? "—"}</td>
                <td className="px-3 py-2 font-mono break-all" title={`ID ${t.id}`}>{t.referencia ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt style={{ color: "var(--color-faint)" }}>{k}</dt>
      <dd className="truncate" style={{ color: "var(--color-ink)" }} title={v}>{v}</dd>
    </div>
  );
}

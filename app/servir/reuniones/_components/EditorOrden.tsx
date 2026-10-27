"use client";

import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import type { ItemOrdenPlantilla, Resultado, TipoItemOrden } from "@/lib/servir/contratos";
import { duracion, horaBogota } from "../_lib/fechas";

export type ItemEditable = ItemOrdenPlantilla & { id?: string };
type Fila = ItemEditable & { key: string };

export const TIPOS_ITEM: { value: TipoItemOrden; label: string }[] = [
  { value: "encabezado", label: "Encabezado" },
  { value: "cancion", label: "Canción" },
  { value: "predica", label: "Prédica" },
  { value: "oracion", label: "Oración" },
  { value: "anuncio", label: "Anuncio" },
  { value: "otro", label: "Otro" },
];

// "5" → 300, "4:30" → 270. null si no se entiende.
function leerDuracion(txt: string): number | null {
  const t = txt.trim();
  if (!t) return 0;
  const m = /^(\d{1,3})(?::(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const s = m[2] ? Number(m[2]) : 0;
  if (s > 59) return null;
  return Number(m[1]) * 60 + s;
}

function escribirDuracion(seg: number | null): string {
  if (!seg) return "";
  return seg % 60 === 0 ? String(seg / 60) : duracion(seg);
}

let contador = 0;
const nuevaKey = () => `n${++contador}`;

export function EditorOrden({
  inicial,
  editable,
  startsAt,
  canciones,
  onGuardar,
  textoGuardar = "Guardar orden",
  cambiosExternos = false,
}: {
  inicial: ItemEditable[];
  editable: boolean;
  startsAt?: string | null;
  canciones: { id: string; title: string }[];
  onGuardar?: (items: (ItemEditable & { sort: number })[]) => Promise<Resultado<unknown>>;
  textoGuardar?: string;
  // Hay cambios fuera del editor (p. ej. el nombre de la plantilla).
  cambiosExternos?: boolean;
}) {
  const [filas, setFilas] = useState<Fila[]>(() => inicial.map((i) => ({ ...i, key: i.id ?? nuevaKey() })));
  const [textos, setTextos] = useState<Record<string, string>>(() =>
    Object.fromEntries(filas.map((f) => [f.key, escribirDuracion(f.duration_sec)])));
  const [sucio, setSucio] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const guardable = sucio || cambiosExternos;

  const total = filas.reduce((s, f) => s + (f.duration_sec ?? 0), 0);
  const horas = useMemo(() => {
    if (!startsAt) return null;
    let t = new Date(startsAt).getTime();
    return filas.map((f) => {
      const h = horaBogota(new Date(t).toISOString());
      t += (f.duration_sec ?? 0) * 1000;
      return h;
    });
  }, [filas, startsAt]);

  function cambiar(next: Fila[]) {
    setFilas(next);
    setSucio(true);
    setMensaje(null);
  }

  function actualizar(key: string, cambio: Partial<ItemEditable>) {
    cambiar(filas.map((f) => (f.key === key ? { ...f, ...cambio } : f)));
  }

  function mover(desde: number, hasta: number) {
    if (hasta < 0 || hasta >= filas.length || desde === hasta) return;
    const next = [...filas];
    const [f] = next.splice(desde, 1);
    next.splice(hasta, 0, f);
    cambiar(next);
  }

  function agregar(kind: TipoItemOrden) {
    const key = nuevaKey();
    const dur = kind === "cancion" ? 300 : kind === "encabezado" ? 0 : 600;
    setTextos((t) => ({ ...t, [key]: escribirDuracion(dur) }));
    cambiar([...filas, { key, kind, title: "", duration_sec: dur, song_id: null, responsible_position_id: null }]);
  }

  function guardar() {
    if (!onGuardar) return;
    const malos = filas.filter((f) => leerDuracion(textos[f.key] ?? "") === null);
    if (malos.length) return setMensaje({ ok: false, texto: "Escribe las duraciones en minutos (5) o minutos:segundos (4:30)." });
    if (filas.some((f) => !f.title.trim())) return setMensaje({ ok: false, texto: "Cada ítem necesita un título." });
    startTransition(async () => {
      const r = await onGuardar(filas.map(({ key: _k, ...f }, sort) => ({ ...f, sort })));
      if (r.ok) setSucio(false);
      setMensaje(r.ok ? { ok: true, texto: "Guardado." } : { ok: false, texto: r.error });
    });
  }

  return (
    <section className="card p-4 md:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold">Orden</h2>
        <span className="inline-flex items-center gap-1.5 text-[14px] tabular" style={{ color: "var(--color-muted)" }}>
          <Icon name="clock" size={15} />
          Total {duracion(total)}
          {horas && filas.length > 0 && <> · termina {horaBogota(new Date(new Date(startsAt!).getTime() + total * 1000).toISOString())}</>}
        </span>
      </div>

      {filas.length === 0 && (
        <p className="text-[14px] py-4 text-center" style={{ color: "var(--color-muted)" }}>
          {editable ? "Todavía no hay ítems. Agrega el primero abajo." : "Esta reunión todavía no tiene orden."}
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {filas.map((f, i) => {
          const esEncabezado = f.kind === "encabezado";
          return (
            <li
              key={f.key}
              draggable={editable}
              onDragStart={() => setArrastrando(f.key)}
              onDragEnd={() => setArrastrando(null)}
              onDragOver={(e) => { if (arrastrando) e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const desde = filas.findIndex((x) => x.key === arrastrando);
                if (desde >= 0) mover(desde, i);
                setArrastrando(null);
              }}
              className="flex gap-3 items-start rounded-[var(--radius-control)] px-3 py-2.5"
              style={{
                background: esEncabezado ? "var(--color-surface-2)" : "var(--color-bg-elev)",
                border: "1px solid var(--color-line)",
                opacity: arrastrando === f.key ? 0.5 : 1,
              }}
            >
              <div className="w-12 flex-none pt-2 text-[13px] tabular font-semibold" style={{ color: "var(--color-muted)" }}>
                {horas ? horas[i] : `${i + 1}.`}
              </div>

              {editable ? (
                <div className="flex-1 min-w-0 grid gap-2 md:grid-cols-[140px_minmax(0,1fr)_88px] md:items-center">
                  <select
                    aria-label="Tipo de ítem"
                    value={f.kind}
                    onChange={(e) => actualizar(f.key, { kind: e.target.value as TipoItemOrden })}
                    className="input filter-select"
                  >
                    {TIPOS_ITEM.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <div className="flex flex-col gap-2 min-w-0">
                    <input
                      aria-label="Título"
                      value={f.title}
                      placeholder={esEncabezado ? "Sección (p. ej. Alabanza)" : "Título"}
                      onChange={(e) => actualizar(f.key, { title: e.target.value })}
                      className="input"
                      style={esEncabezado ? { fontWeight: 600 } : undefined}
                    />
                    {f.kind === "cancion" && canciones.length > 0 && (
                      <select
                        aria-label="Canción de la biblioteca"
                        value={f.song_id ?? ""}
                        onChange={(e) => {
                          const song = canciones.find((c) => c.id === e.target.value);
                          actualizar(f.key, { song_id: song?.id ?? null, title: song && !f.title.trim() ? song.title : f.title });
                        }}
                        className="input filter-select"
                      >
                        <option value="">Sin canción de la biblioteca</option>
                        {canciones.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    )}
                  </div>
                  <input
                    aria-label="Duración en minutos"
                    inputMode="numeric"
                    placeholder="min"
                    value={textos[f.key] ?? ""}
                    onChange={(e) => {
                      const txt = e.target.value;
                      setTextos((t) => ({ ...t, [f.key]: txt }));
                      const seg = leerDuracion(txt);
                      if (seg !== null) actualizar(f.key, { duration_sec: seg });
                      else { setSucio(true); }
                    }}
                    className="input tabular text-right"
                  />
                </div>
              ) : (
                <div className="flex-1 min-w-0 pt-1.5 flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className={esEncabezado ? "font-semibold text-[15px]" : "text-[15px]"}>{f.title}</p>
                    {!esEncabezado && (
                      <p className="text-[12px]" style={{ color: "var(--color-faint)" }}>
                        {TIPOS_ITEM.find((t) => t.value === f.kind)?.label}
                      </p>
                    )}
                  </div>
                  {!!f.duration_sec && <span className="text-[13px] tabular flex-none" style={{ color: "var(--color-muted)" }}>{duracion(f.duration_sec)}</span>}
                </div>
              )}

              {editable && (
                <div className="flex flex-col md:flex-row gap-1 flex-none">
                  <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} disabled={i === 0} onClick={() => mover(i, i - 1)}>
                    <Icon name="chevron-up" size={15} label="Subir" />
                  </button>
                  <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} disabled={i === filas.length - 1} onClick={() => mover(i, i + 1)}>
                    <Icon name="chevron-down" size={15} label="Bajar" />
                  </button>
                  <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => cambiar(filas.filter((x) => x.key !== f.key))}>
                    <Icon name="close" size={15} label="Quitar" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {editable && (
        <>
          <div className="flex flex-wrap gap-2">
            {TIPOS_ITEM.map((t) => (
              <button key={t.value} type="button" onClick={() => agregar(t.value)}
                className="h-9 px-3 rounded-full text-[13px] font-semibold inline-flex items-center gap-1"
                style={{ background: "var(--color-surface-2)", color: "var(--color-ink)" }}>
                <Icon name="plus" size={14} />
                {t.label}
              </button>
            ))}
          </div>
          {onGuardar && (
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t" style={{ borderColor: "var(--color-line)" }}>
              <button type="button" className="btn-primary" disabled={pendiente || !guardable} onClick={guardar} style={{ opacity: pendiente || !guardable ? 0.5 : 1 }}>
                {pendiente ? "Guardando…" : textoGuardar}
              </button>
              {guardable && !mensaje && <span className="text-[13px]" style={{ color: "var(--color-muted)" }}>Hay cambios sin guardar.</span>}
              {mensaje && (
                <span role="status" className="text-[13px] font-medium" style={{ color: mensaje.ok ? "var(--color-positive)" : "var(--color-critical)" }}>
                  {mensaje.texto}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

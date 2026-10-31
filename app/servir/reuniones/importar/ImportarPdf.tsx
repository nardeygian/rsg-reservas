"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import type { TipoItemOrden } from "@/lib/servir/contratos";
import type { Lectura } from "@/lib/servir/importar-pdf";
import { duracion, fechaLarga } from "../_lib/fechas";
import type { RespuestaLeer } from "./leer/route";
import { confirmarImportacion } from "./actions";
import {
  armarOrden, normalizar, textoResponsables,
  type CancionCatalogo, type DecisionCancion, type ItemBorrador,
} from "./_lib/revision";

type Tipo = { id: string; name: string; usual_time: string | null; duration_min: number | null };

const KIND_LABEL: Record<TipoItemOrden, string> = {
  cancion: "Canción", predica: "Prédica", oracion: "Oración", anuncio: "Anuncio", encabezado: "Encabezado", otro: "Otro",
};
const MAX_MB = 4;

export function ImportarPdf({
  tipos, catalogo, puedeCrearCanciones,
}: {
  tipos: Tipo[]; catalogo: CancionCatalogo[]; puedeCrearCanciones: boolean;
}) {
  const [fase, setFase] = useState<"subir" | "leyendo" | "revisar">("subir");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previa, setPrevia] = useState<{ meetingId: string; nombre: string; fecha: string } | null>(null);
  const [lectura, setLectura] = useState<{ importId: string; datos: Lectura } | null>(null);

  async function leer(forzar = false) {
    if (!archivo) return;
    if (archivo.size > MAX_MB * 1024 * 1024) return setError(`El PDF pesa más de ${MAX_MB} MB.`);
    setError(null);
    setPrevia(null);
    setFase("leyendo");
    const form = new FormData();
    form.append("pdf", archivo);
    if (forzar) form.append("forzar", "1");
    try {
      const res = await fetch("/servir/reuniones/importar/leer", { method: "POST", body: form });
      const r = (await res.json().catch(() => null)) as RespuestaLeer | null;
      if (!r) throw new Error();
      if (!r.ok) {
        setFase("subir");
        setError(r.error);
        if (r.yaImportada) setPrevia(r.yaImportada);
        return;
      }
      setLectura({ importId: r.importId, datos: r.lectura });
      setFase("revisar");
    } catch {
      setFase("subir");
      setError("No se pudo leer el PDF. Revisa tu conexión e intenta de nuevo.");
    }
  }

  if (fase === "revisar" && lectura) {
    return (
      <Revision
        key={lectura.importId}
        importId={lectura.importId}
        lectura={lectura.datos}
        tipos={tipos}
        catalogo={catalogo}
        puedeCrearCanciones={puedeCrearCanciones}
        onOtro={() => { setLectura(null); setArchivo(null); setFase("subir"); }}
      />
    );
  }

  const leyendo = fase === "leyendo";
  return (
    <div className="card p-5 md:p-7 flex flex-col gap-4 md:max-w-[640px]">
      <label
        className="flex flex-col items-center justify-center gap-2 rounded-2xl px-4 py-10 text-center cursor-pointer"
        style={{ border: "1.5px dashed var(--color-line-strong)", background: "var(--color-surface-2)", opacity: leyendo ? 0.6 : 1 }}
      >
        <Icon name="paperclip" size={22} style={{ color: "var(--color-muted)" }} />
        <span className="text-[15px] font-semibold">{archivo ? archivo.name : "Elegir PDF"}</span>
        <span className="text-xs" style={{ color: "var(--color-faint)" }}>
          {archivo ? `${(archivo.size / 1024).toFixed(0)} KB` : `Orden del servicio de WorshipTools, Planning Center u otro. Máximo ${MAX_MB} MB.`}
        </span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={leyendo}
          onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setError(null); setPrevia(null); }}
        />
      </label>

      {error && <p role="alert" className="text-[14px] font-medium" style={{ color: "var(--color-critical)" }}>{error}</p>}
      {previa && (
        <div className="flex flex-col gap-2 text-[14px]">
          <p>
            Se importó como{" "}
            <Link href={`/servir/reuniones/${previa.meetingId}`} className="font-semibold underline">
              {previa.nombre} · {fechaLarga(previa.fecha)}
            </Link>.
          </p>
          <button type="button" className="btn-secondary self-start" onClick={() => leer(true)}>Leerlo de todas formas</button>
        </div>
      )}

      <button type="button" className="btn-primary w-full" disabled={!archivo || leyendo} onClick={() => leer()}
        style={{ opacity: !archivo || leyendo ? 0.6 : 1 }}>
        {leyendo ? "Leyendo el PDF… (puede tardar un minuto)" : "Leer PDF"}
      </button>
      <p className="text-xs -mt-2" style={{ color: "var(--color-faint)" }}>
        El PDF lo lee Claude (IA) y no se guarda. Nada se crea hasta que confirmes.
      </p>
    </div>
  );
}

function Revision({
  importId, lectura, tipos, catalogo, puedeCrearCanciones, onOtro,
}: {
  importId: string; lectura: Lectura; tipos: Tipo[]; catalogo: CancionCatalogo[];
  puedeCrearCanciones: boolean; onOtro: () => void;
}) {
  const router = useRouter();
  const r = lectura.reunion;
  const tipoInicial = r.tipo ? tipos.find((t) => normalizar(t.name) === normalizar(r.tipo!)) ?? null : null;

  const [tipoId, setTipoId] = useState(tipoInicial?.id ?? "");
  const [nombre, setNombre] = useState(r.nombre || tipoInicial?.name || "");
  const [fecha, setFecha] = useState(r.fecha ?? "");
  const [hora, setHora] = useState(r.hora_inicio ?? tipoInicial?.usual_time?.slice(0, 5) ?? "");
  const [durMin, setDurMin] = useState(r.duracion_min ? String(r.duracion_min) : tipoInicial?.duration_min ? String(tipoInicial.duration_min) : "");
  const [items, setItems] = useState<ItemBorrador[]>(() => armarOrden(lectura, catalogo).map((i) =>
    i.cancion?.decision.modo === "crear" && !puedeCrearCanciones
      ? { ...i, cancion: { ...i.cancion, decision: { modo: "omitir" } } }
      : i));
  const [notas, setNotas] = useState(() => [
    r.notas,
    r.espacio ? `Lugar (según el PDF): ${r.espacio}` : null,
    lectura.responsables.length ? `Responsables (según el PDF)\n\n${textoResponsables(lectura.responsables)}` : null,
  ].filter(Boolean).join("\n\n"));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const arriba = useRef<HTMLDivElement>(null);

  const incluidos = items.filter((i) => i.incluir);
  const canciones = incluidos.filter((i) => i.cancion);
  const nuevas = new Set(canciones.filter((i) => i.cancion!.decision.modo === "crear").map((i) => normalizar(i.cancion!.titulo))).size;
  const enlazadas = canciones.filter((i) => i.cancion!.decision.modo === "enlazar").length;

  function cambiar(key: string, cambio: Partial<ItemBorrador>) {
    setItems(items.map((i) => (i.key === key ? { ...i, ...cambio } : i)));
  }

  function decidir(item: ItemBorrador, valor: string) {
    const decision: DecisionCancion = valor === "crear" ? { modo: "crear" }
      : valor === "omitir" ? { modo: "omitir" }
      : { modo: "enlazar", songId: valor };
    cambiar(item.key, { cancion: { titulo: item.cancion!.titulo, decision } });
  }

  function elegirTipo(id: string) {
    const t = tipos.find((x) => x.id === id) ?? null;
    setTipoId(id);
    if (!nombre.trim() && t) setNombre(t.name);
    if (!hora && t?.usual_time) setHora(t.usual_time.slice(0, 5));
    if (!durMin && t?.duration_min) setDurMin(String(t.duration_min));
  }

  function confirmar() {
    setError(null);
    if (!nombre.trim()) return setError("Ponle un nombre a la reunión.");
    if (!fecha) return setError("Falta la fecha de la reunión.");
    const dur = durMin ? Number(durMin) : null;
    if (dur !== null && !(dur > 0)) return setError("La duración debe ser mayor que cero.");
    startTransition(async () => {
      const res = await confirmarImportacion({
        importId,
        meeting_type_id: tipoId || null,
        name: nombre,
        meeting_date: fecha,
        hora: hora || null,
        duracion_min: hora ? dur : null,
        notes: notas || null,
        items: incluidos.map((i) => ({
          kind: i.kind, title: i.title, duration_sec: i.duration_sec,
          song_key: i.song_key, notes: i.notes, cancion: i.cancion,
        })),
      });
      if (!res.ok) {
        setError(res.error);
        arriba.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      router.push(`/servir/reuniones/${res.data.id}`);
    });
  }

  return (
    <div ref={arriba} className="grid gap-5 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] md:items-start scroll-mt-4">
      <div className="flex flex-col gap-5 min-w-0">
        {lectura.advertencias.length > 0 && (
          <div className="card p-4 md:p-5 flex flex-col gap-2" style={{ borderColor: "var(--color-gold-text)" }}>
            <p className="field-label">Revisa esto</p>
            <ul className="flex flex-col gap-1.5 text-[14px]">
              {lectura.advertencias.map((a, n) => <li key={n}>· {a}</li>)}
            </ul>
          </div>
        )}

        <section className="card p-4 md:p-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[16px] font-semibold">Orden del servicio</h2>
            <span className="text-xs" style={{ color: "var(--color-faint)" }}>{incluidos.length} de {items.length} renglones</span>
          </div>
          {items.length === 0 && (
            <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>El PDF no trae un orden. La reunión se crea con el orden vacío.</p>
          )}
          <ol className="flex flex-col">
            {items.map((i) => (
              <li key={i.key} className="flex gap-3 py-2.5" style={{ borderTop: "1px solid var(--color-line)", opacity: i.incluir ? 1 : 0.45 }}>
                <input type="checkbox" className="mt-2.5 h-4 w-4 flex-none" checked={i.incluir}
                  aria-label={`Incluir ${i.title}`} onChange={(e) => cambiar(i.key, { incluir: e.target.checked })} />
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div className="flex gap-2">
                    <input className="input flex-1 min-w-0" value={i.title} maxLength={200} disabled={!i.incluir}
                      aria-label="Título" onChange={(e) => cambiar(i.key, { title: e.target.value })} />
                    <select className="input w-auto flex-none" value={i.kind} disabled={!i.incluir} aria-label="Tipo de renglón"
                      onChange={(e) => cambiar(i.key, { kind: e.target.value as TipoItemOrden })}>
                      {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--color-muted)" }}>
                    {i.duration_sec > 0 && <span className="tabular">{duracion(i.duration_sec)}</span>}
                    {i.song_key && <span>Tono {i.song_key}</span>}
                    {i.notes && <span>{i.notes}</span>}
                  </div>
                  {i.cancion && i.incluir && (
                    <select
                      className="input text-[13px]"
                      aria-label={`Canción del catálogo para ${i.cancion.titulo}`}
                      value={i.cancion.decision.modo === "enlazar" ? i.cancion.decision.songId : i.cancion.decision.modo}
                      onChange={(e) => decidir(i, e.target.value)}
                    >
                      {puedeCrearCanciones && <option value="crear">Crear canción nueva: «{i.cancion.titulo}»</option>}
                      <option value="omitir">No enlazar a una canción</option>
                      <optgroup label="Enlazar a una del catálogo">
                        {catalogo.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}{c.default_key ? ` (${c.default_key})` : ""}</option>
                        ))}
                      </optgroup>
                    </select>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <p className="text-xs" style={{ color: "var(--color-faint)" }}>
            La hora del PDF queda al inicio de cada título. Las duraciones se calculan entre horas; puedes ajustarlas después en el editor del orden.
          </p>
        </section>
      </div>

      <div className="flex flex-col gap-5 md:sticky md:top-4">
        <section className="card p-4 md:p-5 flex flex-col gap-4">
          <h2 className="text-[16px] font-semibold">Reunión</h2>
          <div>
            <label htmlFor="i-tipo" className="field-label block mb-1.5">Tipo de reunión</label>
            <select id="i-tipo" className="input" value={tipoId} onChange={(e) => elegirTipo(e.target.value)}>
              <option value="">Sin tipo</option>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {r.tipo && !tipoInicial && (
              <p className="text-xs mt-1.5" style={{ color: "var(--color-faint)" }}>El PDF sugiere «{r.tipo}», que no está entre los tipos.</p>
            )}
          </div>
          <div>
            <label htmlFor="i-nombre" className="field-label block mb-1.5">Nombre</label>
            <input id="i-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} required />
          </div>
          <div>
            <label htmlFor="i-fecha" className="field-label block mb-1.5">Fecha</label>
            <input id="i-fecha" type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="i-hora" className="field-label block mb-1.5">Hora de inicio</label>
              <input id="i-hora" type="time" className="input" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
            <div>
              <label htmlFor="i-dur" className="field-label block mb-1.5">Duración (min)</label>
              <input id="i-dur" type="number" min={1} max={1440} inputMode="numeric" className="input" value={durMin}
                onChange={(e) => setDurMin(e.target.value)} disabled={!hora} />
            </div>
          </div>
          <div>
            <label htmlFor="i-notas" className="field-label block mb-1.5">Notas para el equipo</label>
            <textarea id="i-notas" rows={8} className="input py-2 text-[13px]" value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={5000} />
            {lectura.responsables.length > 0 && (
              <p className="text-xs mt-1.5" style={{ color: "var(--color-faint)" }}>
                Los responsables del PDF quedan en las notas. Asigna el equipo desde la reunión.
              </p>
            )}
          </div>
        </section>

        <section className="card p-4 md:p-5 flex flex-col gap-3">
          <p className="text-[14px]">
            Se crea <strong>1 reunión en borrador</strong> con {incluidos.length} {incluidos.length === 1 ? "renglón" : "renglones"}
            {canciones.length > 0 && <>; {enlazadas} {enlazadas === 1 ? "canción enlazada" : "canciones enlazadas"} y {nuevas} {nuevas === 1 ? "nueva" : "nuevas"} en el catálogo</>}.
          </p>
          {error && <p role="alert" className="text-[14px] font-medium" style={{ color: "var(--color-critical)" }}>{error}</p>}
          <button type="button" className="btn-primary w-full" disabled={pendiente} onClick={confirmar} style={{ opacity: pendiente ? 0.6 : 1 }}>
            {pendiente ? "Creando…" : "Crear reunión"}
          </button>
          <button type="button" className="btn-ghost w-full" disabled={pendiente} onClick={onOtro}>Subir otro PDF</button>
        </section>
      </div>
    </div>
  );
}

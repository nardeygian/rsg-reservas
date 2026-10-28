"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import { guardarCancion } from "../actions";
import { limpiarEtiquetas, SECCIONES_SUGERIDAS, seccionesDeLetra, TONOS } from "../_lib/canciones";
import { LetraSecciones } from "./ui";

export type DatosCancion = {
  id?: string;
  title: string;
  artist: string;
  default_key: string;
  bpm: string;
  ccli: string;
  tags: string[];
  lyrics: string;
};

export function FormCancion({ inicial, sugerenciasEtiquetas }: { inicial: DatosCancion; sugerenciasEtiquetas: string[] }) {
  const router = useRouter();
  const [d, setD] = useState<DatosCancion>(inicial);
  const [etiqueta, setEtiqueta] = useState("");
  const [vista, setVista] = useState<"editar" | "previa">("editar");
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const letraRef = useRef<HTMLTextAreaElement>(null);
  const poner = <K extends keyof DatosCancion>(k: K, v: DatosCancion[K]) => {
    setGuardado(false);
    setD((x) => ({ ...x, [k]: v }));
  };

  function agregarEtiqueta(raw: string) {
    const nuevas = limpiarEtiquetas([...d.tags, ...raw.split(",")]);
    poner("tags", nuevas);
    setEtiqueta("");
  }

  // Inserta "[Coro]" en una línea propia donde está el cursor.
  function insertarSeccion(nombre: string) {
    const el = letraRef.current;
    const pos = el ? el.selectionStart : d.lyrics.length;
    const antes = d.lyrics.slice(0, pos);
    const despues = d.lyrics.slice(pos);
    const prefijo = antes && !antes.endsWith("\n") ? "\n\n" : antes.endsWith("\n\n") || !antes ? "" : "\n";
    const marca = `${prefijo}[${nombre}]\n`;
    poner("lyrics", antes + marca + despues);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = pos + marca.length;
    });
  }

  const sugeridas = sugerenciasEtiquetas.filter(
    (t) => !d.tags.some((x) => x.toLocaleLowerCase("es") === t.toLocaleLowerCase("es")) &&
      (!etiqueta || t.toLocaleLowerCase("es").includes(etiqueta.toLocaleLowerCase("es"))),
  ).slice(0, 8);

  const previa = <LetraSecciones secciones={seccionesDeLetra(d.lyrics)} />;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const tags = etiqueta.trim() ? limpiarEtiquetas([...d.tags, etiqueta]) : d.tags;
          const r = await guardarCancion({
            id: d.id,
            title: d.title,
            artist: d.artist,
            default_key: d.default_key,
            bpm: d.bpm ? Number(d.bpm) : null,
            ccli: d.ccli,
            tags,
            lyrics: d.lyrics,
          });
          if (!r.ok) return setError(r.error);
          if (!d.id) {
            router.replace(`/servir/canciones/${r.data.id}/editar?nueva=1`);
            return;
          }
          setEtiqueta("");
          setD((x) => ({ ...x, tags }));
          setGuardado(true);
          router.refresh();
        });
      }}
    >
      <div className="card p-5 md:p-7 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="titulo" className="field-label block mb-1.5">Título</label>
          <input id="titulo" className="input" value={d.title} onChange={(e) => poner("title", e.target.value)} required maxLength={200} />
        </div>
        <div>
          <label htmlFor="artista" className="field-label block mb-1.5">Artista</label>
          <input id="artista" className="input" value={d.artist} onChange={(e) => poner("artist", e.target.value)} maxLength={120} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="tono" className="field-label block mb-1.5">Tono</label>
            <select id="tono" className="input px-2" value={d.default_key} onChange={(e) => poner("default_key", e.target.value)}>
              <option value="">–</option>
              {d.default_key && !TONOS.includes(d.default_key) && <option value={d.default_key}>{d.default_key}</option>}
              {TONOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="bpm" className="field-label block mb-1.5">BPM</label>
            <input id="bpm" type="number" inputMode="numeric" min={20} max={300} className="input px-3" value={d.bpm} onChange={(e) => poner("bpm", e.target.value)} />
          </div>
          <div>
            <label htmlFor="ccli" className="field-label block mb-1.5">CCLI</label>
            <input id="ccli" inputMode="numeric" className="input px-3" value={d.ccli} onChange={(e) => poner("ccli", e.target.value)} maxLength={20} />
          </div>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="etiqueta" className="field-label block mb-1.5">Etiquetas</label>
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {d.tags.map((t) => (
              <button
                key={t}
                type="button"
                className="chip chip-accent gap-1"
                aria-label={`Quitar etiqueta ${t}`}
                onClick={() => poner("tags", d.tags.filter((x) => x !== t))}
              >
                {t}
                <Icon name="close" size={12} />
              </button>
            ))}
          </div>
          <input
            id="etiqueta"
            className="input"
            placeholder="Adoración, rápida, Navidad… (Enter para agregar)"
            value={etiqueta}
            onChange={(e) => {
              if (e.target.value.includes(",")) agregarEtiqueta(e.target.value);
              else setEtiqueta(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (etiqueta.trim()) agregarEtiqueta(etiqueta);
              }
            }}
            maxLength={40}
          />
          {sugeridas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {sugeridas.map((t) => (
                <button key={t} type="button" className="chip chip-muted gap-1" onClick={() => agregarEtiqueta(t)}>
                  <Icon name="plus" size={12} />
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card p-5 md:p-7 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold">Letra</h2>
            <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>
              Marca cada parte en su propia línea: [Verso 1], [Coro], [Puente].
            </p>
          </div>
          <div className="segmented md:hidden" role="group" aria-label="Vista de la letra">
            <button type="button" aria-pressed={vista === "editar"} onClick={() => setVista("editar")}>Editar</button>
            <button type="button" aria-pressed={vista === "previa"} onClick={() => setVista("previa")}>Vista previa</button>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2 md:items-start">
          <div className={`flex flex-col gap-2 ${vista === "previa" ? "hidden md:flex" : ""}`}>
            <div className="flex flex-wrap gap-1.5">
              {SECCIONES_SUGERIDAS.map((s) => (
                <button key={s} type="button" className="chip chip-muted gap-1" onClick={() => insertarSeccion(s)}>
                  <Icon name="plus" size={12} />
                  {s}
                </button>
              ))}
            </div>
            <textarea
              ref={letraRef}
              aria-label="Letra"
              className="input py-3 min-h-[360px] md:min-h-[520px] font-[inherit] leading-relaxed"
              value={d.lyrics}
              onChange={(e) => poner("lyrics", e.target.value)}
              placeholder={"[Verso 1]\nPrimera línea\nSegunda línea\n\n[Coro]\n…"}
              spellCheck
            />
          </div>
          <div
            className={`rounded-[var(--radius-control)] p-4 md:p-5 md:max-h-[580px] md:overflow-auto ${vista === "editar" ? "hidden md:block" : ""}`}
            style={{ background: "var(--color-surface-2)" }}
            aria-label="Vista previa de la letra"
          >
            <p className="eyebrow mb-3 hidden md:block">Vista previa</p>
            {previa}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-[14px] font-semibold" style={{ color: "var(--color-down)" }}>{error}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pendiente}>
          {pendiente ? "Guardando…" : d.id ? "Guardar cambios" : "Crear canción"}
        </button>
        {guardado && (
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: "var(--color-up)" }}>
            <Icon name="check" size={16} />
            Guardado
          </span>
        )}
      </div>
    </form>
  );
}

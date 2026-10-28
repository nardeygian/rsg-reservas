"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BPM_RANGOS, ORDENES, USOS } from "../_lib/canciones";

export function FiltrosCanciones({
  etiquetas, tonos, artistas, editor,
}: {
  etiquetas: string[];
  tonos: string[];
  artistas: string[];
  editor: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const primera = useRef(true);

  function poner(cambios: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // La búsqueda se aplica sola al dejar de escribir.
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    const t = setTimeout(() => poner({ q: q.trim() }), 300);
    return () => clearTimeout(t);
  }, [q]);

  const select = (clave: string, etiqueta: string, todos: string, opciones: { value: string; label: string }[]) => (
    <select
      aria-label={etiqueta}
      className="input filter-select md:w-auto md:min-w-[150px]"
      value={params.get(clave) ?? ""}
      onChange={(e) => poner({ [clave]: e.target.value })}
    >
      <option value="">{todos}</option>
      {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const hayFiltros = ["q", "etiqueta", "tono", "artista", "bpm", "uso", "archivadas"].some((k) => params.get(k));

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        className="input"
        placeholder="Buscar por título o artista"
        aria-label="Buscar canciones"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3">
        {select("etiqueta", "Filtrar por etiqueta", "Todas las etiquetas", etiquetas.map((t) => ({ value: t, label: t })))}
        {select("tono", "Filtrar por tono", "Todos los tonos", tonos.map((t) => ({ value: t, label: t })))}
        {select("bpm", "Filtrar por BPM", "Cualquier BPM", BPM_RANGOS)}
        {select("artista", "Filtrar por artista", "Todos los artistas", artistas.map((a) => ({ value: a, label: a })))}
        {select("uso", "Filtrar por último uso", "Cualquier uso", USOS)}
        <select
          aria-label="Ordenar"
          className="input filter-select md:w-auto md:min-w-[150px]"
          value={params.get("orden") ?? ""}
          onChange={(e) => poner({ orden: e.target.value })}
        >
          {ORDENES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3 min-h-[24px]">
        {editor && (
          <label className="inline-flex items-center gap-2 text-[13px]" style={{ color: "var(--color-muted)" }}>
            <input type="checkbox" checked={params.get("archivadas") === "1"} onChange={(e) => poner({ archivadas: e.target.checked ? "1" : "" })} />
            Ver archivadas
          </label>
        )}
        {hayFiltros && (
          <button
            type="button"
            className="text-[13px] font-semibold"
            style={{ color: "var(--color-accent)" }}
            onClick={() => {
              setQ("");
              router.replace(pathname, { scroll: false });
            }}
          >
            Quitar filtros
          </button>
        )}
      </div>
    </div>
  );
}

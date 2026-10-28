"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import { createClient } from "@/lib/supabase/client";
import { borrarArchivoCancion, cambiarTipoArchivo, prepararSubidaCancion, subirArchivoCancion } from "../actions";
import {
  ACCEPT_ARCHIVOS,
  MAX_BYTES,
  MIME_PERMITIDOS,
  tamano,
  TIPOS_ARCHIVO,
  tipoSugerido,
  type ArchivoCancion,
  type TipoArchivo,
} from "../_lib/canciones";

// Algunos navegadores no dan el MIME de .m4a o .txt: se deduce de la extensión.
function mimeDe(f: File): string {
  if (f.type && MIME_PERMITIDOS.includes(f.type)) return f.type;
  const ext = f.name.split(".").pop()?.toLowerCase();
  const porExt: Record<string, string> = {
    pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    txt: "text/plain", mp3: "audio/mpeg", m4a: "audio/mp4",
  };
  return (ext && porExt[ext]) || f.type;
}

function href(songId: string, a: ArchivoCancion, descargar = false) {
  return `/servir/canciones/${songId}/archivo?path=${encodeURIComponent(a.path)}${descargar ? "&descargar=1" : ""}`;
}

// Lista de archivos para todos; con `editor`, subir, cambiar tipo y borrar.
export function Archivos({ songId, archivos, editor }: { songId: string; archivos: ArchivoCancion[]; editor: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<TipoArchivo | "">("");
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  async function subir(files: FileList) {
    setError(null);
    for (const f of Array.from(files)) {
      const mime = mimeDe(f);
      if (!MIME_PERMITIDOS.includes(mime)) {
        setError(`"${f.name}": ese tipo de archivo no se admite. Sube PDF, imagen, texto, MP3 o M4A.`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        setError(`"${f.name}" pesa más de 20 MB.`);
        continue;
      }
      setSubiendo(f.name);
      const prep = await prepararSubidaCancion(songId, { name: f.name, type: mime, size: f.size });
      if (!prep.ok) {
        setError(prep.error);
        continue;
      }
      const { error: errSubida } = await createClient()
        .storage.from("songs")
        .uploadToSignedUrl(prep.data.path, prep.data.token, f, { contentType: mime });
      if (errSubida) {
        setError(`No se pudo subir "${f.name}": ${errSubida.message}`);
        continue;
      }
      const fd = new FormData();
      fd.set("path", prep.data.path);
      fd.set("name", f.name);
      fd.set("kind", kind || tipoSugerido(mime));
      const r = await subirArchivoCancion(songId, fd);
      if (!r.ok) setError(r.error);
    }
    setSubiendo(null);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  function correr(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "No se pudo guardar.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {archivos.length === 0 ? (
        <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>
          {editor ? "Sube letras, acordes, partituras o audios de referencia." : "Esta canción no tiene archivos."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {archivos.map((a) => (
            <li key={a.path} className="flex items-center gap-3 py-2">
              <span
                className="w-9 h-9 flex-none rounded-[12px] flex items-center justify-center"
                style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}
                aria-hidden
              >
                <Icon name="paperclip" size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <a href={href(songId, a)} target="_blank" rel="noopener" className="text-[14px] font-semibold truncate block hover:underline">
                  {a.name}
                </a>
                <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--color-muted)" }}>
                  {editor ? (
                    <select
                      aria-label={`Tipo de ${a.name}`}
                      className="bg-transparent text-[12px] font-semibold -ml-0.5"
                      value={a.kind}
                      disabled={pendiente}
                      onChange={(e) => correr(() => cambiarTipoArchivo(songId, a.path, e.target.value as TipoArchivo))}
                    >
                      {TIPOS_ARCHIVO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  ) : (
                    <span className="font-semibold">{TIPOS_ARCHIVO.find((t) => t.value === a.kind)?.label}</span>
                  )}
                  {a.size ? <span className="tabular">{tamano(a.size)}</span> : null}
                </div>
              </div>
              <a href={href(songId, a, true)} className="icon-btn" aria-label={`Descargar ${a.name}`} title="Descargar">
                <Icon name="arrow-right" size={16} className="rotate-90" />
              </a>
              {editor && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Borrar ${a.name}`}
                  title="Borrar"
                  disabled={pendiente}
                  onClick={() => {
                    if (confirm(`¿Borrar "${a.name}"? No se puede deshacer.`)) correr(() => borrarArchivoCancion(songId, a.path));
                  }}
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editor && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select aria-label="Tipo del archivo a subir" className="input filter-select w-auto" value={kind} onChange={(e) => setKind(e.target.value as TipoArchivo | "")}>
            <option value="">Tipo automático</option>
            {TIPOS_ARCHIVO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className={`btn-secondary min-h-[40px] text-[14px] cursor-pointer ${subiendo ? "opacity-60 pointer-events-none" : ""}`}>
            <Icon name="plus" size={16} />
            {subiendo ? `Subiendo ${subiendo}…` : "Subir archivo"}
            <input
              ref={input}
              type="file"
              className="sr-only"
              accept={ACCEPT_ARCHIVOS}
              multiple
              disabled={!!subiendo}
              onChange={(e) => e.target.files?.length && subir(e.target.files)}
            />
          </label>
          <span className="text-[12px]" style={{ color: "var(--color-faint)" }}>PDF, imagen, texto, MP3 o M4A · hasta 20 MB</span>
        </div>
      )}

      {error && <p role="alert" className="text-[14px] font-semibold" style={{ color: "var(--color-down)" }}>{error}</p>}
    </div>
  );
}

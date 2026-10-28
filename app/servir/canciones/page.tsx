import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import { BotonEnlace, Encabezado, Pagina } from "../reuniones/_components/ui";
import { hoyBogota, sumarDias } from "../reuniones/_lib/fechas";
import { FiltrosCanciones } from "./_components/FiltrosCanciones";
import { UltimoUso } from "./_components/ui";
import { archivosDe } from "./_lib/canciones";
import { puedeEditarCanciones, servirClient, usuarioActual } from "./_lib/db";

export const metadata = { title: "Canciones · Servir" };

type Params = {
  q?: string; etiqueta?: string; tono?: string; artista?: string;
  bpm?: string; uso?: string; orden?: string; archivadas?: string;
};

type Fila = {
  id: string; title: string; artist: string | null; default_key: string | null; bpm: number | null;
  tags: string[]; last_used_on: string | null; files: unknown;
};

// Caracteres que rompen el filtro .or() de PostgREST.
function textoBusqueda(q: string): string {
  return q.replace(/[,()%*\\"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function FilaCancion({ c, hoy }: { c: Fila; hoy: string }) {
  const archivos = archivosDe(c.files).length;
  return (
    <li>
      <Link
        href={`/servir/canciones/${c.id}`}
        prefetch={false}
        className="flex items-center gap-3 px-3 py-3 rounded-[var(--radius-control)] transition hover:bg-[var(--color-surface-2)]"
      >
        <div
          className="w-11 h-11 flex-none rounded-[12px] flex items-center justify-center text-[15px] font-semibold tabular"
          style={{ background: "var(--color-surface-2)", color: c.default_key ? "var(--color-ink)" : "var(--color-faint)" }}
          aria-label={c.default_key ? `Tono ${c.default_key}` : "Sin tono"}
        >
          {c.default_key ?? "–"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold truncate">{c.title}</p>
          <p className="text-[13px] flex items-center gap-1.5 min-w-0" style={{ color: "var(--color-muted)" }}>
            <span className="truncate">{c.artist ?? "Sin artista"}</span>
            {c.bpm && <span className="tabular flex-none">· {c.bpm} BPM</span>}
            {archivos > 0 && (
              <span className="inline-flex items-center gap-0.5 flex-none tabular" aria-label={`${archivos} archivos`}>
                · <Icon name="paperclip" size={12} />{archivos}
              </span>
            )}
          </p>
          {c.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5 md:hidden">
              {c.tags.slice(0, 3).map((t) => <span key={t} className="chip chip-muted">{t}</span>)}
            </div>
          )}
        </div>
        <div className="hidden md:flex flex-wrap justify-end gap-1 max-w-[260px]">
          {c.tags.slice(0, 3).map((t) => <span key={t} className="chip chip-muted">{t}</span>)}
        </div>
        <UltimoUso fecha={c.last_used_on} hoy={hoy} corto />
        <Icon name="chevron-right" size={16} className="hidden md:block flex-none" style={{ color: "var(--color-faint)" }} />
      </Link>
    </li>
  );
}

export default async function CancionesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) redirect("/login");

  const editor = await puedeEditarCanciones(supabase);
  const archivadas = editor && p.archivadas === "1";
  const hoy = hoyBogota();

  let q = supabase
    .from("songs")
    .select("id, title, artist, default_key, bpm, tags, last_used_on, files")
    .eq("active", !archivadas);

  const busqueda = textoBusqueda(p.q ?? "");
  if (busqueda) q = q.or(`title.ilike.%${busqueda}%,artist.ilike.%${busqueda}%`);
  if (p.etiqueta) q = q.contains("tags", [p.etiqueta]);
  if (p.tono) q = q.eq("default_key", p.tono);
  if (p.artista) q = q.eq("artist", p.artista);
  if (p.bpm === "lento") q = q.lt("bpm", 80);
  else if (p.bpm === "medio") q = q.gte("bpm", 80).lte("bpm", 120);
  else if (p.bpm === "rapido") q = q.gt("bpm", 120);
  if (p.uso === "programada") q = q.gt("last_used_on", hoy);
  else if (p.uso === "reciente") q = q.gte("last_used_on", sumarDias(hoy, -30)).lte("last_used_on", hoy);
  else if (p.uso === "antigua") q = q.lt("last_used_on", sumarDias(hoy, -90));
  else if (p.uso === "nunca") q = q.is("last_used_on", null);

  if (p.orden === "uso") q = q.order("last_used_on", { ascending: false, nullsFirst: false });
  else if (p.orden === "menos") q = q.order("last_used_on", { ascending: true, nullsFirst: true });
  else if (p.orden === "bpm") q = q.order("bpm", { ascending: true, nullsFirst: false });
  q = q.order("title");

  const [{ data: canciones, error }, { data: todas }] = await Promise.all([
    q.limit(500),
    supabase.from("songs").select("artist, default_key, tags").eq("active", true).limit(2000),
  ]);

  // Opciones de los filtros, sacadas de la biblioteca misma.
  const orden = (a: string, b: string) => a.localeCompare(b, "es");
  const etiquetas = [...new Set((todas ?? []).flatMap((s) => s.tags))].sort(orden);
  const tonos = [...new Set((todas ?? []).map((s) => s.default_key).filter((t): t is string => !!t))].sort(orden);
  const artistas = [...new Set((todas ?? []).map((s) => s.artist).filter((a): a is string => !!a))].sort(orden);
  const filas = (canciones ?? []) as Fila[];
  const filtrando = Object.entries(p).some(([k, v]) => k !== "orden" && !!v);

  return (
    <Pagina>
      <Encabezado
        titulo="Canciones"
        subtitulo={editor ? "La biblioteca de alabanza: letras, tonos y archivos." : "Letras, tonos y archivos de las canciones."}
      >
        {editor && (
          <BotonEnlace href="/servir/canciones/nueva" primario>
            <Icon name="plus" size={16} />
            Nueva canción
          </BotonEnlace>
        )}
      </Encabezado>

      <FiltrosCanciones etiquetas={etiquetas} tonos={tonos} artistas={artistas} editor={editor} />

      <section className="card p-2 md:p-4 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3 px-3 pt-2 pb-1">
          <h2 className="text-[17px] font-semibold">{archivadas ? "Archivadas" : "Biblioteca"}</h2>
          <span className="text-[13px] tabular" style={{ color: "var(--color-muted)" }}>
            {filas.length}{filas.length >= 500 ? "+" : ""} {filas.length === 1 ? "canción" : "canciones"}
          </span>
        </div>
        {error ? (
          <p className="text-[14px] px-3 pb-4" style={{ color: "var(--color-down)" }}>No se pudo cargar la biblioteca.</p>
        ) : filas.length === 0 ? (
          <p className="text-[14px] px-3 pb-4" style={{ color: "var(--color-muted)" }}>
            {filtrando ? "Ninguna canción coincide con estos filtros." : editor ? "Todavía no hay canciones. Crea la primera." : "Todavía no hay canciones."}
          </p>
        ) : (
          <ul className="flex flex-col">
            {filas.map((c) => <FilaCancion key={c.id} c={c} hoy={hoy} />)}
          </ul>
        )}
      </section>
    </Pagina>
  );
}

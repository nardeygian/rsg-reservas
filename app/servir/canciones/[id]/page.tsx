import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import { BotonEnlace, Encabezado, EstadoChip, Pagina } from "../../reuniones/_components/ui";
import { fechaCorta, hoyBogota } from "../../reuniones/_lib/fechas";
import { Archivos } from "../_components/Archivos";
import { LetraSecciones, UltimoUso } from "../_components/ui";
import { archivosDe, seccionesDeLetra } from "../_lib/canciones";
import { puedeEditarCanciones, servirClient, usuarioActual } from "../_lib/db";

type Uso = {
  id: string;
  song_key: string | null;
  meetings: { id: string; name: string; meeting_date: string; status: string } | null;
};

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="eyebrow">{etiqueta}</span>
      <span className="text-[17px] font-semibold tabular truncate" style={{ color: valor ? "var(--color-ink)" : "var(--color-faint)" }}>
        {valor ?? "–"}
      </span>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await servirClient();
  const { data } = await supabase.from("songs").select("title").eq("id", id).maybeSingle();
  return { title: `${data?.title ?? "Canción"} · Servir` };
}

export default async function CancionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) redirect("/login");

  const [{ data: c }, editor, { data: usosData }] = await Promise.all([
    supabase.from("songs").select("id, title, artist, default_key, bpm, ccli, tags, lyrics, files, last_used_on, active").eq("id", id).maybeSingle(),
    puedeEditarCanciones(supabase),
    // RLS decide en qué reuniones puede ver cada quien que se usó.
    supabase.from("run_items").select("id, song_key, meetings!run_items_meeting_id_fkey(id, name, meeting_date, status)").eq("song_id", id).limit(200),
  ]);
  if (!c) notFound();

  const hoy = hoyBogota();
  const usos = ((usosData ?? []) as unknown as Uso[])
    .filter((u): u is Uso & { meetings: NonNullable<Uso["meetings"]> } => !!u.meetings)
    .sort((a, b) => b.meetings.meeting_date.localeCompare(a.meetings.meeting_date))
    .slice(0, 8);
  const archivos = archivosDe(c.files);

  return (
    <Pagina>
      <Encabezado
        titulo={c.title}
        subtitulo={c.artist ?? undefined}
        volver={{ href: "/servir/canciones", label: "Canciones" }}
      >
        {editor && <BotonEnlace href={`/servir/canciones/${id}/editar`}>Editar</BotonEnlace>}
        <BotonEnlace href={`/servir/canciones/${id}/letra`} primario>
          Ver letra
          <Icon name="arrow-right" size={16} />
        </BotonEnlace>
      </Encabezado>

      {!c.active && (
        <p className="chip chip-gold self-start">Archivada</p>
      )}

      <div className="grid gap-5 md:grid-cols-[1fr_380px] md:items-start">
        <section className="card p-5 md:p-7 flex flex-col gap-4 md:order-2">
          <div className="grid grid-cols-3 gap-3">
            <Dato etiqueta="Tono" valor={c.default_key} />
            <Dato etiqueta="BPM" valor={c.bpm ? String(c.bpm) : null} />
            <Dato etiqueta="CCLI" valor={c.ccli} />
          </div>
          {c.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {c.tags.map((t) => (
                <Link key={t} href={`/servir/canciones?etiqueta=${encodeURIComponent(t)}`} className="chip chip-muted">{t}</Link>
              ))}
            </div>
          )}
          <UltimoUso fecha={c.last_used_on} hoy={hoy} />

          <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid var(--color-line)" }}>
            <h2 className="text-[15px] font-semibold pt-2">Archivos</h2>
            <Archivos songId={c.id} archivos={archivos} editor={false} />
            {editor && (
              <Link href={`/servir/canciones/${id}/editar#archivos`} className="text-[13px] font-semibold self-start" style={{ color: "var(--color-accent)" }}>
                Subir o quitar archivos
              </Link>
            )}
          </div>

          {usos.length > 0 && (
            <div className="flex flex-col gap-1 pt-2" style={{ borderTop: "1px solid var(--color-line)" }}>
              <h2 className="text-[15px] font-semibold pt-2 pb-1">En reuniones</h2>
              <ul className="flex flex-col">
                {usos.map((u) => (
                  <li key={u.id}>
                    <Link
                      href={`/servir/canciones/${id}/letra?item=${u.id}`}
                      className="flex items-center gap-2 py-2 text-[14px]"
                    >
                      <span className="flex-1 min-w-0 truncate">
                        <span className="font-semibold">{u.meetings.name}</span>
                        <span style={{ color: "var(--color-muted)" }}> · {fechaCorta(u.meetings.meeting_date)}</span>
                        {u.song_key && <span style={{ color: "var(--color-muted)" }}> · {u.song_key}</span>}
                      </span>
                      <EstadoChip status={u.meetings.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card p-5 md:p-7 flex flex-col gap-4 md:order-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold">Letra</h2>
            {c.lyrics && (
              <Link href={`/servir/canciones/${id}/letra`} className="text-[13px] font-semibold" style={{ color: "var(--color-accent)" }}>
                Letra grande
              </Link>
            )}
          </div>
          <LetraSecciones secciones={seccionesDeLetra(c.lyrics)} />
        </section>
      </div>
    </Pagina>
  );
}

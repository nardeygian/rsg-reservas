import { notFound, redirect } from "next/navigation";
import { Encabezado, Pagina, SinAcceso } from "../../../reuniones/_components/ui";
import { Archivar } from "../../_components/Archivar";
import { Archivos } from "../../_components/Archivos";
import { FormCancion } from "../../_components/FormCancion";
import { archivosDe } from "../../_lib/canciones";
import { puedeEditarCanciones, servirClient, usuarioActual } from "../../_lib/db";

export const metadata = { title: "Editar canción · Servir" };

export default async function EditarCancionPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nueva?: string }>;
}) {
  const [{ id }, { nueva }] = await Promise.all([params, searchParams]);
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) redirect("/login");

  const [{ data: c }, editor, { data: todas }] = await Promise.all([
    supabase.from("songs").select("id, title, artist, default_key, bpm, ccli, tags, lyrics, files, active").eq("id", id).maybeSingle(),
    puedeEditarCanciones(supabase),
    supabase.from("songs").select("tags").eq("active", true).limit(2000),
  ]);
  if (!c) notFound();
  const volver = { href: `/servir/canciones/${id}`, label: c.title };

  if (!editor) {
    return (
      <Pagina>
        <Encabezado titulo="Editar canción" volver={volver} />
        <SinAcceso texto="Para editar canciones necesitas el permiso de editar canciones." />
      </Pagina>
    );
  }

  const etiquetas = [...new Set((todas ?? []).flatMap((s) => s.tags))].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <Pagina>
      <Encabezado
        titulo={nueva ? "Canción creada" : "Editar canción"}
        subtitulo={nueva ? "Ahora puedes subir sus archivos." : undefined}
        volver={volver}
      />
      <FormCancion
        key={c.id}
        inicial={{
          id: c.id,
          title: c.title,
          artist: c.artist ?? "",
          default_key: c.default_key ?? "",
          bpm: c.bpm ? String(c.bpm) : "",
          ccli: c.ccli ?? "",
          tags: c.tags,
          lyrics: c.lyrics ?? "",
        }}
        sugerenciasEtiquetas={etiquetas}
      />
      <section id="archivos" className="card p-5 md:p-7 flex flex-col gap-3">
        <h2 className="text-[17px] font-semibold">Archivos</h2>
        <Archivos songId={c.id} archivos={archivosDe(c.files)} editor />
      </section>
      <section className="card p-5 md:p-7 flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">{c.active ? "Archivar" : "Archivada"}</h2>
        <Archivar id={c.id} activa={c.active} />
      </section>
    </Pagina>
  );
}

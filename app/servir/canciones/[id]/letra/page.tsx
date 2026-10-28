import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import { fechaCorta } from "../../../reuniones/_lib/fechas";
import { LetraGrande } from "../../_components/LetraGrande";
import { seccionesDeLetra } from "../../_lib/canciones";
import { servirClient, usuarioActual } from "../../_lib/db";

export const metadata = { title: "Letra · Servir" };

type ItemCancion = { id: string; sort: number; song_id: string | null; title: string };

// /servir/canciones/{id}/letra[?item={run_item_id}]
// Con `item` (un ítem del orden de una reunión) muestra el tono de esa
// reunión y deja pasar a la canción anterior o siguiente del orden. RLS
// decide si el usuario puede ver ese orden.
export default async function LetraPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ item?: string }>;
}) {
  const [{ id }, { item: itemId }] = await Promise.all([params, searchParams]);
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) redirect("/login");

  const [{ data: c }, { data: item }] = await Promise.all([
    supabase.from("songs").select("id, title, artist, default_key, bpm, lyrics").eq("id", id).maybeSingle(),
    itemId
      ? supabase.from("run_items").select("id, meeting_id, song_id, song_key, meetings!run_items_meeting_id_fkey(id, name, meeting_date)").eq("id", itemId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!c) notFound();

  const reunion = item && item.song_id === id
    ? (item.meetings as unknown as { id: string; name: string; meeting_date: string } | null)
    : null;

  // Canciones vecinas en el orden de la reunión.
  let anterior: ItemCancion | null = null;
  let siguiente: ItemCancion | null = null;
  if (reunion && item) {
    const { data: orden } = await supabase
      .from("run_items")
      .select("id, sort, song_id, title")
      .eq("meeting_id", item.meeting_id)
      .not("song_id", "is", null)
      .order("sort");
    const lista = (orden ?? []) as ItemCancion[];
    const i = lista.findIndex((x) => x.id === item.id);
    if (i > 0) anterior = lista[i - 1];
    if (i >= 0 && i < lista.length - 1) siguiente = lista[i + 1];
  }

  const tono = (reunion && item?.song_key) || c.default_key;
  const volver = reunion
    ? { href: `/servir/reuniones/${reunion.id}`, label: reunion.name }
    : { href: `/servir/canciones/${id}`, label: "Canción" };
  const enlace = (x: ItemCancion) => `/servir/canciones/${x.song_id}/letra?item=${x.id}`;

  return (
    <main className="min-h-dvh px-4 pt-5 pb-[calc(var(--nav-space)+24px)] md:pb-12 max-w-2xl mx-auto w-full flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <Link href={volver.href} className="inline-flex items-center gap-1 text-[14px] font-semibold self-start max-w-full" style={{ color: "var(--color-muted)" }}>
          <Icon name="chevron-left" size={16} className="flex-none" />
          <span className="truncate">{volver.label}</span>
          {reunion && <span className="flex-none">· {fechaCorta(reunion.meeting_date)}</span>}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="page-title">{c.title}</h1>
            {c.artist && <p className="text-[15px]" style={{ color: "var(--color-muted)" }}>{c.artist}</p>}
          </div>
          <div className="flex flex-col items-end gap-1 flex-none">
            {tono && <span className="chip chip-accent text-[15px] px-3 py-1" aria-label={`Tono ${tono}`}>{tono}</span>}
            {c.bpm && <span className="text-[13px] tabular" style={{ color: "var(--color-muted)" }}>{c.bpm} BPM</span>}
          </div>
        </div>
      </header>

      <article className="card p-5 md:p-8">
        <LetraGrande secciones={seccionesDeLetra(c.lyrics)} />
      </article>

      {(anterior || siguiente) && (
        <nav className="grid grid-cols-2 gap-3" aria-label="Canciones del orden">
          {anterior ? (
            <Link href={enlace(anterior)} className="card p-4 flex flex-col gap-0.5 min-w-0">
              <span className="eyebrow inline-flex items-center gap-1"><Icon name="chevron-left" size={12} />Anterior</span>
              <span className="text-[14px] font-semibold truncate">{anterior.title}</span>
            </Link>
          ) : <span />}
          {siguiente && (
            <Link href={enlace(siguiente)} className="card p-4 flex flex-col gap-0.5 min-w-0 text-right">
              <span className="eyebrow inline-flex items-center gap-1 self-end">Siguiente<Icon name="chevron-right" size={12} /></span>
              <span className="text-[14px] font-semibold truncate">{siguiente.title}</span>
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}

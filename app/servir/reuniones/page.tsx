import { redirect } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import { permisos, servirClient, usuarioActual } from "./_lib/db";
import { horaBogota, hoyBogota } from "./_lib/fechas";
import { BotonEnlace, Encabezado, ESTADOS, Pagina } from "./_components/ui";
import { Filtros } from "./_components/Filtros";
import { ListaReuniones, type FilaLista } from "./_components/ListaReuniones";

export const metadata = { title: "Reuniones · Servir" };

type Fila = {
  id: string;
  name: string;
  meeting_date: string;
  starts_at: string | null;
  status: string;
  meeting_type_id: string | null;
  archived_at: string | null;
};

// "archivada" no es un estado: filtra las reuniones archivadas.
const FILTRO_ESTADOS = [...ESTADOS, { value: "archivada", label: "Archivadas" }] as const;
const ESTADOS_VALIDOS = new Set(FILTRO_ESTADOS.map((e) => e.value as string));

export default async function ReunionesPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; estado?: string }>;
}) {
  const params = await searchParams;
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) redirect("/login");

  const hoy = hoyBogota();
  const tipoFiltro = params.tipo ?? "";
  const estadoFiltro = params.estado && ESTADOS_VALIDOS.has(params.estado) ? params.estado : "";

  // RLS decide qué reuniones existen para cada quien: un servidor sin
  // permiso solo ve las que tiene asignadas.
  const consulta = (proximas: boolean) => {
    let q = supabase
      .from("meetings")
      .select("id, name, meeting_date, starts_at, status, meeting_type_id, archived_at")
      .order("meeting_date", { ascending: proximas })
      .order("starts_at", { ascending: proximas, nullsFirst: false });
    q = proximas ? q.gte("meeting_date", hoy) : q.lt("meeting_date", hoy);
    if (tipoFiltro === "sin_tipo") q = q.is("meeting_type_id", null);
    else if (tipoFiltro) q = q.eq("meeting_type_id", tipoFiltro);
    if (estadoFiltro === "archivada") q = q.not("archived_at", "is", null);
    else {
      q = q.is("archived_at", null);
      if (estadoFiltro) q = q.eq("status", estadoFiltro);
    }
    return q.limit(proximas ? 200 : 150);
  };

  const [{ data: proximas }, { data: anteriores }, { data: tiposData }, puede] = await Promise.all([
    consulta(true),
    consulta(false),
    supabase.from("meeting_types").select("id, name, color, active").order("sort").order("name"),
    permisos(supabase),
  ]);
  const tipos = new Map((tiposData ?? []).map((t) => [t.id, { name: t.name, color: t.color }]));
  // Borrar: pasadas solo super admin; futuras también quien planea (la
  // base lo vuelve a exigir). Solo sirve para mostrar u ocultar el botón.
  const [{ data: superAdmin }, { data: planeaGlobal }] = await Promise.all([
    supabase.rpc("is_super_admin"),
    supabase.rpc("has_global_permission", { p_permission: "servir.planear" }),
  ]);
  const aFila = (r: Fila): FilaLista => {
    const t = r.meeting_type_id ? tipos.get(r.meeting_type_id) : undefined;
    const paso = r.meeting_date < hoy || r.status === "en_vivo" || r.status === "cerrada";
    return {
      id: r.id, name: r.name, meeting_date: r.meeting_date, starts_at: r.starts_at, status: r.status,
      tipo: t?.name ?? null, color: t?.color ?? null, archivada: !!r.archived_at,
      puedeBorrar: superAdmin === true || (planeaGlobal === true && !paso),
    };
  };

  const filtrando = !!(tipoFiltro || estadoFiltro);

  return (
    <Pagina>
      <Encabezado
        titulo="Reuniones"
        subtitulo={puede.planear ? "Crea, ordena y publica las reuniones de la iglesia." : "Las reuniones donde sirves y su orden."}
      >
        {/* Tipos y plantillas ya está en las pestañas de Servir. */}
        {puede.planear && (
          <BotonEnlace href="/servir/reuniones/nueva" primario>
            <Icon name="plus" size={16} />
            Nueva reunión
          </BotonEnlace>
        )}
        {puede.importar && (
          <BotonEnlace href="/servir/reuniones/importar">
            <Icon name="paperclip" size={16} />
            Importar PDF
          </BotonEnlace>
        )}
      </Encabezado>

      <Filtros tipos={(tiposData ?? []).map((t) => ({ id: t.id, name: t.name }))} estados={[...FILTRO_ESTADOS]} />

      <ListaReuniones
        proximas={((proximas ?? []) as Fila[]).map(aFila)}
        anteriores={((anteriores ?? []) as Fila[]).map(aFila)}
        puedeEditar={puede.planear}
        vacio={filtrando ? "No hay próximas reuniones con estos filtros." : "No hay próximas reuniones."}
      />
    </Pagina>
  );
}

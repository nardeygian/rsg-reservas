import { redirect } from "next/navigation";
import { permisos, servirClient, usuarioActual } from "../_lib/db";
import { hoyBogota } from "../_lib/fechas";
import { Encabezado, Pagina, SinAcceso } from "../_components/ui";
import { FormNuevaReunion } from "./FormNuevaReunion";

export const metadata = { title: "Nueva reunión · Servir" };

export default async function NuevaReunionPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo } = await searchParams;
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) redirect("/login");
  const puede = await permisos(supabase);

  if (!puede.planear) {
    return (
      <Pagina>
        <Encabezado titulo="Nueva reunión" volver={{ href: "/servir/reuniones", label: "Reuniones" }} />
        <SinAcceso texto="Solo Planeación puede crear reuniones." />
      </Pagina>
    );
  }

  const [{ data: tipos }, { data: plantillas }] = await Promise.all([
    supabase
      .from("meeting_types")
      .select("id, name, color, usual_weekday, usual_time, duration_min, default_template_id")
      .eq("active", true)
      .order("sort")
      .order("name"),
    supabase
      .from("meeting_templates")
      .select("id, name, version, meeting_type_id, run_sheet")
      .order("name")
      .order("version", { ascending: false }),
  ]);

  return (
    <Pagina>
      <Encabezado
        titulo="Nueva reunión"
        subtitulo="Elige el tipo y la fecha: hora, duración y orden llegan de su plantilla."
        volver={{ href: "/servir/reuniones", label: "Reuniones" }}
      />
      <FormNuevaReunion
        tipos={tipos ?? []}
        plantillas={(plantillas ?? []).map((p) => ({
          id: p.id, name: p.name, version: p.version, meeting_type_id: p.meeting_type_id,
          items: Array.isArray(p.run_sheet) ? p.run_sheet.length : 0,
        }))}
        hoy={hoyBogota()}
        tipoInicial={tipo ?? null}
      />
    </Pagina>
  );
}

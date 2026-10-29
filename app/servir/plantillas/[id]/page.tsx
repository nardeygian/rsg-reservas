import { notFound, redirect } from "next/navigation";
import type { ItemOrdenPlantilla } from "@/lib/servir/contratos";
import { permisos, servirClient, usuarioActual } from "../../reuniones/_lib/db";
import { Encabezado, Pagina } from "../../reuniones/_components/ui";
import { EditorPlantilla } from "./EditorPlantilla";
import { EspaciosPlantilla } from "./EspaciosPlantilla";

export const metadata = { title: "Plantilla · Servir" };

export default async function PlantillaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) redirect("/login");

  const { data: t } = await supabase
    .from("meeting_templates")
    .select("id, name, version, run_sheet, meeting_type_id, created_from_meeting_id, space_ids, setup_minutes, teardown_minutes, meeting_types!meeting_templates_meeting_type_id_fkey(id, name, default_template_id, usual_space_ids, setup_minutes, teardown_minutes)")
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();

  const [puede, { data: canciones }, { data: espacios }, { data: puedeMontaje }] = await Promise.all([
    permisos(supabase),
    supabase.from("songs").select("id, title").eq("active", true).order("title").limit(500),
    supabase.from("spaces").select("id, name, capacity, booking_policy").eq("status", "active").order("name"),
    supabase.rpc("has_global_permission", { p_permission: "servir.planear" }),
  ]);
  const tipo = t.meeting_types as {
    id: string; name: string; default_template_id: string | null;
    usual_space_ids: string[]; setup_minutes: number; teardown_minutes: number;
  } | null;
  const propios = t.space_ids !== null || t.setup_minutes !== null || t.teardown_minutes !== null
    ? { space_ids: t.space_ids ?? tipo?.usual_space_ids ?? [], setup_minutes: t.setup_minutes ?? tipo?.setup_minutes ?? 120, teardown_minutes: t.teardown_minutes ?? tipo?.teardown_minutes ?? 60 }
    : null;
  const runSheet = (Array.isArray(t.run_sheet) ? t.run_sheet : []) as unknown as ItemOrdenPlantilla[];

  return (
    <Pagina>
      <Encabezado
        titulo={`${t.name} · v${t.version}`}
        subtitulo={tipo ? `Plantilla de ${tipo.name}` : "Plantilla sin tipo"}
        volver={{ href: "/servir/plantillas", label: "Tipos y plantillas" }}
      />
      <EditorPlantilla
        key={t.id}
        plantilla={{ id: t.id, name: t.name, version: t.version, run_sheet: runSheet }}
        editable={puede.plantillas}
        canciones={canciones ?? []}
        tipo={tipo ? { id: tipo.id, name: tipo.name } : null}
        esPorDefecto={tipo?.default_template_id === t.id}
        espacios={
          <EspaciosPlantilla
            plantillaId={t.id}
            espacios={espacios ?? []}
            propios={propios}
            delTipo={{ space_ids: tipo?.usual_space_ids ?? [], setup_minutes: tipo?.setup_minutes ?? 120, teardown_minutes: tipo?.teardown_minutes ?? 60 }}
            editable={puedeMontaje === true}
          />
        }
      />
    </Pagina>
  );
}

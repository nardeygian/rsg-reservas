import { notFound, redirect } from "next/navigation";
import type { ItemOrdenPlantilla } from "@/lib/servir/contratos";
import { permisos, servirClient, usuarioActual } from "../../reuniones/_lib/db";
import { Encabezado, Pagina } from "../../reuniones/_components/ui";
import { EditorPlantilla } from "./EditorPlantilla";

export const metadata = { title: "Plantilla · Servir" };

export default async function PlantillaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) redirect("/login");

  const { data: t } = await supabase
    .from("meeting_templates")
    .select("id, name, version, run_sheet, meeting_type_id, created_from_meeting_id, meeting_types!meeting_templates_meeting_type_id_fkey(id, name, default_template_id)")
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();

  const [puede, { data: canciones }] = await Promise.all([
    permisos(supabase),
    supabase.from("songs").select("id, title").eq("active", true).order("title").limit(500),
  ]);
  const tipo = t.meeting_types as { id: string; name: string; default_template_id: string | null } | null;
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
      />
    </Pagina>
  );
}

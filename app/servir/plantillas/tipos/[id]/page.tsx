import { notFound, redirect } from "next/navigation";
import type { ClaseReunion, Conteo } from "@/lib/servir/contratos";
import { permisos, servirClient, usuarioActual } from "../../../reuniones/_lib/db";
import { Encabezado, Pagina, SinAcceso } from "../../../reuniones/_components/ui";
import type { DatosTipo } from "../../actions";
import { FormTipo } from "./FormTipo";

export const metadata = { title: "Tipo de reunión · Servir" };

const VACIO: DatosTipo = {
  name: "", ministry_id: null, counting: "min", kind: "ministerio", color: null,
  usual_weekday: null, usual_time: null, duration_min: null, usual_space_ids: [],
  setup_minutes: 120, teardown_minutes: 60, default_template_id: null, active: true,
};

export default async function TipoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const nuevo = id === "nuevo";
  if (!nuevo && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) redirect("/login");
  const puede = await permisos(supabase);

  const volver = { href: "/servir/plantillas", label: "Tipos y plantillas" };
  if (!puede.plantillas) {
    return (
      <Pagina>
        <Encabezado titulo={nuevo ? "Nuevo tipo" : "Tipo de reunión"} volver={volver} />
        <SinAcceso texto="Solo Planeación y los pastores de ministerio editan tipos de reunión." />
      </Pagina>
    );
  }

  const [tipoRes, { data: ministerios }, { data: espacios }, { data: plantillas }, { data: puedeMontaje }] = await Promise.all([
    nuevo
      ? Promise.resolve({ data: null })
      : supabase
          .from("meeting_types")
          .select("id, name, ministry_id, counting, kind, color, usual_weekday, usual_time, duration_min, usual_space_ids, setup_minutes, teardown_minutes, default_template_id, active")
          .eq("id", id)
          .maybeSingle(),
    supabase.from("ministries").select("id, name").order("name"),
    supabase.from("spaces").select("id, name, capacity, booking_policy").eq("status", "active").order("name"),
    nuevo
      ? Promise.resolve({ data: [] as { id: string; name: string; version: number }[] })
      : supabase.from("meeting_templates").select("id, name, version").eq("meeting_type_id", id).order("name").order("version", { ascending: false }),
    supabase.rpc("has_global_permission", { p_permission: "servir.planear" }),
  ]);
  const t = tipoRes.data;
  if (!nuevo && !t) notFound();

  const inicial: DatosTipo = t
    ? { ...t, counting: t.counting as Conteo, kind: t.kind as ClaseReunion }
    : VACIO;

  return (
    <Pagina>
      <Encabezado
        titulo={t ? t.name : "Nuevo tipo"}
        subtitulo="Lo que se repite en cada reunión de este tipo."
        volver={volver}
      />
      <FormTipo
        inicial={inicial}
        ministerios={ministerios ?? []}
        espacios={espacios ?? []}
        puedeMontaje={puedeMontaje === true}
        plantillas={(plantillas ?? []).map((p) => ({ id: p.id, label: `${p.name} · v${p.version}` }))}
      />
    </Pagina>
  );
}

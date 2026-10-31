import { redirect } from "next/navigation";
import { importarConfigurado } from "@/lib/servir/importar-pdf";
import { servirClient, usuarioActual } from "../_lib/db";
import { Encabezado, Pagina, SinAcceso } from "../_components/ui";
import { ImportarPdf } from "./ImportarPdf";

export const metadata = { title: "Importar reunión · Servir" };

export default async function ImportarReunionPage() {
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) redirect("/login");

  const tiene = async (p: string) => (await supabase.rpc("has_permission", { p_permission: p })).data === true;
  const [importar, planear, editarCanciones] = await Promise.all([
    tiene("servir.importar"), tiene("servir.planear"), tiene("canciones.editar"),
  ]);
  const volver = { href: "/servir/reuniones", label: "Reuniones" };

  if (!importar || !planear) {
    return (
      <Pagina>
        <Encabezado titulo="Importar reunión" volver={volver} />
        <SinAcceso texto="Solo Planeación puede importar reuniones." />
      </Pagina>
    );
  }
  if (!importarConfigurado()) {
    return (
      <Pagina>
        <Encabezado titulo="Importar reunión" volver={volver} />
        <SinAcceso texto="Importar desde PDF no está configurado todavía: falta la clave de la API de Claude (ANTHROPIC_API_KEY)." />
      </Pagina>
    );
  }

  const [{ data: tipos }, { data: canciones }] = await Promise.all([
    supabase.from("meeting_types").select("id, name, usual_time, duration_min").eq("active", true).order("sort").order("name"),
    supabase.from("songs").select("id, title, default_key").eq("active", true).order("title"),
  ]);

  return (
    <Pagina>
      <Encabezado
        titulo="Importar reunión"
        subtitulo="Sube el PDF del orden del servicio. Revisas lo que se leyó antes de crear nada."
        volver={volver}
      />
      <ImportarPdf tipos={tipos ?? []} catalogo={canciones ?? []} puedeCrearCanciones={editarCanciones} />
    </Pagina>
  );
}

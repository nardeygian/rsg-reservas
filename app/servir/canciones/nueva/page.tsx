import { redirect } from "next/navigation";
import { Encabezado, Pagina, SinAcceso } from "../../reuniones/_components/ui";
import { FormCancion } from "../_components/FormCancion";
import { puedeEditarCanciones, servirClient, usuarioActual } from "../_lib/db";

export const metadata = { title: "Nueva canción · Servir" };

export default async function NuevaCancionPage() {
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) redirect("/login");
  const editor = await puedeEditarCanciones(supabase);
  const { data: todas } = editor
    ? await supabase.from("songs").select("tags").eq("active", true).limit(2000)
    : { data: [] };
  const etiquetas = [...new Set((todas ?? []).flatMap((s) => s.tags))].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <Pagina>
      <Encabezado titulo="Nueva canción" volver={{ href: "/servir/canciones", label: "Canciones" }} />
      {editor ? (
        <FormCancion
          inicial={{ title: "", artist: "", default_key: "", bpm: "", ccli: "", tags: [], lyrics: "" }}
          sugerenciasEtiquetas={etiquetas}
        />
      ) : (
        <SinAcceso texto="Para crear canciones necesitas el permiso de editar canciones." />
      )}
    </Pagina>
  );
}

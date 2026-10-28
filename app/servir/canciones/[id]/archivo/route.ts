import { NextResponse, type NextRequest } from "next/server";
import { archivosDe } from "../../_lib/canciones";
import { servirClient, usuarioActual } from "../../_lib/db";

// GET /servir/canciones/{id}/archivo?path=…[&descargar=1]
// Redirige a una URL firmada de corta duración del bucket privado 'songs'.
// La firma se pide con la sesión del usuario: RLS de storage decide.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = req.nextUrl.searchParams.get("path") ?? "";
  const descargar = req.nextUrl.searchParams.get("descargar") === "1";

  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) return NextResponse.redirect(new URL("/login", req.url));

  const { data: cancion } = await supabase.from("songs").select("files").eq("id", id).maybeSingle();
  const archivo = archivosDe(cancion?.files).find((a) => a.path === path);
  if (!archivo || !path.startsWith(`${id}/`)) return new NextResponse("Archivo no encontrado", { status: 404 });

  const { data, error } = await supabase.storage
    .from("songs")
    .createSignedUrl(path, 120, descargar ? { download: archivo.name } : undefined);
  if (error || !data) return new NextResponse("No se pudo abrir el archivo", { status: 403 });

  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}

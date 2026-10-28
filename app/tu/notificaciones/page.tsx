import Link from "next/link";
import { redirect } from "next/navigation";
import { clienteServir } from "@/lib/notificaciones/supabase";
import { ActivarPush } from "./ActivarPush";
import { ListaNotificaciones, type FilaBandeja } from "./ListaNotificaciones";
import { ICONOS, IconoFila, Grupo, svg } from "./_ui";

export const metadata = { title: "Notificaciones · Panel RSG" };

export default async function NotificacionesPage() {
  const sb = await clienteServir();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: filas }, { data: audiencias }] = await Promise.all([
    sb.from("notifications")
      .select("id, kind, title, body, link, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    sb.rpc("my_broadcast_audiences"),
  ]);

  const lista = (filas ?? []) as FilaBandeja[];
  const puedeEnviar = (audiencias ?? []).length > 0;

  return (
    <main className="min-h-dvh px-4 pt-6 pb-8 max-w-lg mx-auto flex flex-col gap-7">
      <header className="flex flex-col gap-3">
        <Link href="/perfil" className="btn-ghost -ml-3 self-start px-3 gap-1" style={{ color: "var(--color-accent)" }}>
          {svg(ICONOS.atras, 18)} Tú
        </Link>
        <h1 className="page-title">Notificaciones</h1>
      </header>

      <Grupo
        titulo="Este dispositivo"
        pie="Te avisamos cuando te asignan un servicio, el día antes y dos horas antes de servir. Todo queda también aquí."
      >
        <ActivarPush />
      </Grupo>

      {puedeEnviar && (
        <Grupo>
          <Link href="/tu/notificaciones/enviar" className="flex items-center gap-3 px-4 min-h-[56px]">
            <IconoFila>{svg(ICONOS.megafono)}</IconoFila>
            <span className="flex-1 min-w-0 py-2.5">
              <span className="block text-[15px] font-medium" style={{ color: "var(--color-ink)" }}>Enviar un aviso</span>
              <span className="block text-[13px] truncate" style={{ color: "var(--color-muted)" }}>A tu equipo, ahora o programado</span>
            </span>
            <span style={{ color: "var(--color-faint)" }}>{svg(ICONOS.chevron, 16)}</span>
          </Link>
        </Grupo>
      )}

      <ListaNotificaciones filas={lista} userId={user.id} />
    </main>
  );
}

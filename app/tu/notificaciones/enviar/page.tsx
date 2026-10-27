import Link from "next/link";
import { redirect } from "next/navigation";
import { clienteServir } from "@/lib/notificaciones/supabase";
import { ICONOS, Grupo, svg } from "../_ui";
import { FormEnvio, type OpcionAudiencia } from "./FormEnvio";

export const metadata = { title: "Enviar un aviso · Panel RSG" };

const TZ = "America/Bogota";
const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const GRUPO: Record<string, string> = {
  todos: "Toda la iglesia",
  departamento: "Departamentos",
  area: "Áreas",
  reunion: "Servidores de una reunión",
};

export default async function EnviarPage() {
  const sb = await clienteServir();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: audiencias }, { data: envios }] = await Promise.all([
    sb.rpc("my_broadcast_audiences"),
    sb.from("broadcasts")
      .select("id, audience, scope_id, title, scheduled_for, sent_at, recipients_count")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const opciones: OpcionAudiencia[] = (audiencias ?? []).map((a) => ({
    valor: `${a.audience}:${a.scope_id ?? ""}`,
    etiqueta: a.label,
    grupo: GRUPO[a.audience] ?? a.audience,
  }));
  if (opciones.length === 0) redirect("/tu/notificaciones");
  const nombre = new Map(opciones.map((o) => [o.valor, o.etiqueta]));

  return (
    <main className="min-h-dvh px-4 pt-6 pb-8 max-w-lg mx-auto flex flex-col gap-7">
      <header className="flex flex-col gap-3">
        <Link href="/tu/notificaciones" className="btn-ghost -ml-3 self-start px-3 gap-1" style={{ color: "var(--color-accent)" }}>
          {svg(ICONOS.atras, 18)} Notificaciones
        </Link>
        <h1 className="page-title">Enviar un aviso</h1>
        <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>
          Llega como notificación a cada servidor y queda en su bandeja.
        </p>
      </header>

      <FormEnvio opciones={opciones} />

      {(envios ?? []).length > 0 && (
        <Grupo titulo="Tus envíos">
          {(envios ?? []).map((e) => (
            <div key={e.id} className="flex items-start gap-3 px-4 py-3">
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-medium truncate" style={{ color: "var(--color-ink)" }}>{e.title}</span>
                <span className="block text-[13px] truncate" style={{ color: "var(--color-muted)" }}>
                  {nombre.get(`${e.audience}:${e.scope_id ?? ""}`) ?? GRUPO[e.audience]} · {fecha(e.sent_at ?? e.scheduled_for)}
                </span>
              </span>
              {e.sent_at ? (
                <span className="chip chip-up flex-none">{e.recipients_count ?? 0} {e.recipients_count === 1 ? "persona" : "personas"}</span>
              ) : (
                <span className="chip chip-muted flex-none">Programado</span>
              )}
            </div>
          ))}
        </Grupo>
      )}
    </main>
  );
}

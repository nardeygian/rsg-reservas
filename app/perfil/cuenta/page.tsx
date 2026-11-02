import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import { desvincularIdentidad, resumenEliminacion, vincularProveedor } from "@/lib/cuentas/acciones";
import { cuentasClient } from "@/lib/cuentas/db";
import { PROVEEDORES, proveedoresActivos } from "@/lib/cuentas/proveedores";
import { Fila, Grupo, Inicial, Mensaje, Pagina } from "@/lib/cuentas/ui";
import { EliminarCuenta } from "./EliminarCuenta";

export const metadata = { title: "Cuenta · Panel Resurgencia" };

const OK: Record<string, string> = {
  vinculada: "Listo, ya puedes entrar también con esa cuenta.",
  desvinculada: "Quitamos esa forma de entrar.",
};

export default async function CuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const supabase = await cuentasClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/perfil/cuenta");

  const [activos, { data: puedeInvitar }, { data: persona }, resumen] = await Promise.all([
    proveedoresActivos(),
    supabase.rpc("has_permission", { p_permission: "servir.asignar" }),
    supabase.from("people").select("full_name").eq("profile_id", user.id).maybeSingle(),
    resumenEliminacion(),
  ]);

  const identidades = user.identities ?? [];
  const unica = identidades.length < 2;
  const correo = identidades.find((i) => i.provider === "email");

  return (
    <Pagina titulo="Cuenta" volver={{ href: "/perfil", label: "Perfil" }}>
      <Mensaje error={error} ok={ok ? OK[ok] ?? ok : undefined} />

      <Grupo
        title="Formas de entrar"
        footer="Une Google a esta misma cuenta para no duplicarte si cambias de teléfono. Debe quedar al menos una forma de entrar."
      >
        <Fila
          icon={<Inicial texto="@" />}
          label="Correo"
          detail={correo ? (correo.identity_data?.email as string | undefined) ?? user.email : "Sin contraseña"}
          trailing={correo
            ? <span className="chip chip-up">Activa</span>
            : <Link href="/forgot-password" className="chip chip-muted">Crear</Link>}
        />
        {PROVEEDORES.map((p) => {
          const id = identidades.find((i) => i.provider === p.id);
          const detalle = id ? (id.identity_data?.email as string | undefined) ?? "Vinculada" : "Sin vincular";
          return (
            <Fila
              key={p.id}
              icon={<Inicial texto={p.label[0]} />}
              label={p.label}
              detail={detalle}
              trailing={
                id ? (
                  <form action={desvincularIdentidad}>
                    <input type="hidden" name="identity_id" value={id.identity_id} />
                    <button type="submit" className="btn-ghost text-[14px] min-h-[40px] px-3 disabled:opacity-45" disabled={unica} style={{ color: "var(--color-down)" }}>
                      Quitar
                    </button>
                  </form>
                ) : activos[p.id] ? (
                  <form action={vincularProveedor}>
                    <input type="hidden" name="provider" value={p.id} />
                    <button type="submit" className="btn-ghost text-[14px] min-h-[40px] px-3" style={{ color: "var(--color-accent)" }}>
                      Vincular
                    </button>
                  </form>
                ) : (
                  <span className="chip chip-muted">No disponible</span>
                )
              }
            />
          );
        })}
      </Grupo>

      <Grupo
        title="Servir"
        footer={persona ? undefined : "Tu cuenta todavía no está unida a tu registro de servidor. Escoge tu departamento o abre la invitación de tu líder."}
      >
        <Fila
          icon={<Inicial texto={persona ? persona.full_name.trim()[0]?.toUpperCase() ?? "·" : "·"} />}
          label={persona ? persona.full_name : "Sin unir"}
          detail={persona ? "Tu cuenta está unida a este registro" : "Sin registro de servidor"}
        />
        {!persona && (
          <Link href="/servir/unirme" className="block">
            <Fila
              icon={<span className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}><Icon name="plus" size={17} /></span>}
              label="Unirme a un departamento"
              detail="Tu líder aprueba la solicitud"
              trailing={<Icon name="chevron-right" size={16} style={{ color: "var(--color-faint)" }} />}
            />
          </Link>
        )}
        {puedeInvitar && (
          <Link href="/perfil/cuenta/invitar" className="block">
            <Fila
              icon={<span className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}><Icon name="users" size={17} /></span>}
              label="Invitar a mi equipo"
              detail="Enlace por WhatsApp o correo"
              trailing={<Icon name="chevron-right" size={16} style={{ color: "var(--color-faint)" }} />}
            />
          </Link>
        )}
      </Grupo>

      <EliminarCuenta resumen={resumen} />
    </Pagina>
  );
}

import { redirect } from "next/navigation";
import { cuentasClient } from "@/lib/cuentas/db";
import { InvitarPersona } from "@/lib/cuentas/InvitarPersona";
import { Fila, Grupo, Inicial, Pagina } from "@/lib/cuentas/ui";
import { RevocarInvitacion } from "./RevocarInvitacion";

export const metadata = { title: "Invitar · Panel Resurgencia" };

type Candidata = { id: string; full_name: string; email: string | null; phone: string | null };

const fechaCorta = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" });

export default async function InvitarPage() {
  const supabase = await cuentasClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/perfil/cuenta/invitar");

  // Alcances de servir.asignar: solo para armar la lista. Invitar lo
  // decide la base (crear_invitacion → can_invite_person).
  const { data: alcances } = await supabase.rpc("permission_scopes", { p_permission: "servir.asignar" });
  const scopes = alcances ?? [];
  const global = scopes.some((s) => s.scope_type === null);
  const deptos = scopes.filter((s) => s.scope_type === "departamento").map((s) => s.scope_id);
  const areas = scopes.filter((s) => s.scope_type === "area").map((s) => s.scope_id);

  if (!global && deptos.length === 0 && areas.length === 0) {
    return (
      <Pagina titulo="Invitar a mi equipo" volver={{ href: "/perfil/cuenta", label: "Cuenta" }}>
        <p className="card px-4 py-4 text-[14px]" style={{ color: "var(--color-muted)" }}>
          Solo los líderes que asignan servidores pueden invitar personas. Si crees que deberías poder, habla con Planeación.
        </p>
      </Pagina>
    );
  }

  let candidatas: Candidata[] = [];
  if (global) {
    const { data } = await supabase.from("people").select("id, full_name, email, phone")
      .is("profile_id", null).eq("active", true).order("full_name").limit(300);
    candidatas = data ?? [];
  } else {
    const filtros = [
      deptos.length ? `ministry_id.in.(${deptos.join(",")})` : null,
      areas.length ? `area_id.in.(${areas.join(",")})` : null,
    ].filter(Boolean).join(",");
    const { data } = await supabase.from("team_members")
      .select("people!inner(id, full_name, email, phone, profile_id, active)")
      .eq("active", true).or(filtros);
    const vistas = new Map<string, Candidata>();
    for (const tm of data ?? []) {
      const p = tm.people;
      if (p && p.profile_id === null && p.active) vistas.set(p.id, { id: p.id, full_name: p.full_name, email: p.email, phone: p.phone });
    }
    candidatas = [...vistas.values()].sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
  }

  const { data: pendientes } = await supabase.from("account_invitations")
    .select("id, email, expires_at, created_at, people(full_name)")
    .is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(50);

  return (
    <Pagina titulo="Invitar a mi equipo" volver={{ href: "/perfil/cuenta", label: "Cuenta" }}>
      <p className="text-[14px] -mt-2" style={{ color: "var(--color-muted)" }}>
        Cada persona recibe un enlace personal. Al abrirlo entra con Google, Apple o su correo y su cuenta queda unida a su registro.
      </p>

      {(pendientes?.length ?? 0) > 0 && (
        <Grupo title="Invitaciones pendientes">
          {pendientes!.map((i) => (
            <Fila
              key={i.id}
              icon={<Inicial texto={(i.people?.full_name ?? "·").trim()[0]?.toUpperCase() ?? "·"} />}
              label={i.people?.full_name ?? "Persona"}
              detail={`${i.email ?? "Enlace"} · vence el ${fechaCorta.format(new Date(i.expires_at))}`}
              trailing={<RevocarInvitacion id={i.id} />}
            />
          ))}
        </Grupo>
      )}

      <Grupo
        title={`Sin cuenta (${candidatas.length})`}
        footer={candidatas.length === 0 ? "Todas las personas de tu equipo ya tienen cuenta." : undefined}
      >
        {candidatas.map((p) => (
          <details key={p.id} className="group">
            <summary className="list-none cursor-pointer">
              <Fila
                icon={<Inicial texto={p.full_name.trim()[0]?.toUpperCase() ?? "·"} />}
                label={p.full_name}
                detail={p.email ?? p.phone ?? "Sin contacto"}
                trailing={<span className="chip chip-accent">Invitar</span>}
              />
            </summary>
            <div className="px-4 pb-4">
              <InvitarPersona personId={p.id} nombre={p.full_name} email={p.email} phone={p.phone} />
            </div>
          </details>
        ))}
      </Grupo>
    </Pagina>
  );
}

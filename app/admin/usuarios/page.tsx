import { Icon } from "@/app/_components/ui/Icon";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  inviteUserAction,
  updateUserRoleAction,
  addUserRoleAction,
  removeUserRoleAction,
  asignarGrupoAction,
  deleteUserAction,
} from "./actions";
import { svReadData } from "@/app/servicio/_lib/data";
import type { SvGrupo } from "@/app/servicio/_lib/types";
import { UserSearch, InviteSection, AddRoleForm, DeleteUserButton } from "./_components";

const ROLES = [
  { value: "leader", label: "Líder" },
  { value: "mentor", label: "Líder de discipulado" },
  { value: "pastor_ministerio", label: "Pastor de ministerio" },
  { value: "pastor_sede", label: "Pastor de sede" },
  { value: "admin_casa", label: "Admin de casa" },
  { value: "studio_admin", label: "Admin del Estudio" },
  { value: "planeacion", label: "Planeación" },
  { value: "fundador", label: "Fundador" },
  { value: "servidor", label: "Servidor" },
  { value: "super_admin", label: "Super admin" },
] as const;

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLES.map((r) => [r.value, r.label])
);

const EXTRA_ROLE_LABELS: Record<string, string> = {
  lider_departamento: "Líder de departamento",
  pastor_ministerio: "Pastor de ministerio",
  pastor_sede: "Pastor de sede",
  lider_discipulado: "Líder de discipulado",
  lider_area: "Líder de área",
  servidor_planeacion: "Planeación (Servir)",
};

const REQUESTED_LABELS: Record<string, string> = {
  lider_departamento: "Líder de departamento",
  lider_discipulado: "Líder de discipulado",
  pastor_ministerio: "Pastor de ministerio",
  pastor_sede: "Pastor de sede",
};

type UserRow = {
  id: string;
  full_name: string;
  role: string;
  requested_role: string | null;
  created_at: string;
};

type ExtraRole = {
  id: string;
  role: string;
  ministry_id: string | null;
  ministry_name: string | null;
  ministry_type: string | null;
  area_name: string | null;
};

type Ministry = { id: string; name: string; type: string };

// La solicitud ya está resuelta si el usuario tiene ese rol, sea como rol
// primario o como rol adicional (p. ej. líder de departamento con su depto).
function requestGranted(r: UserRow, extraRoles: ExtraRole[]): boolean {
  const req = r.requested_role;
  if (!req) return true;
  if (req === r.role) return true;
  if (req === "lider_discipulado" && r.role === "mentor") return true;
  return extraRoles.some((er) => er.role === req);
}

function isPending(r: UserRow, extraRoles: ExtraRole[]): boolean {
  if (requestGranted(r, extraRoles)) return false;
  if (r.requested_role === "lider_departamento" && r.role === "leader") return false;
  return r.role === "leader";
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; q?: string }>;
}) {
  const { error, ok, q } = await searchParams;
  const searchQuery = q?.trim() ?? "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!me || me.role !== "super_admin") redirect("/?error=Sin%20permiso");

  const service = createServiceClient();

  let profileQuery = service
    .from("profiles")
    .select("id, full_name, role, requested_role, created_at")
    .order("full_name", { ascending: true });
  if (searchQuery) profileQuery = profileQuery.ilike("full_name", `%${searchQuery}%`);

  const [
    { data: profiles },
    { data: authUsersData },
    { data: allUserRoles },
    { data: ministries },
    svData,
    { data: areas },
  ] = await Promise.all([
    profileQuery.returns<UserRow[]>(),
    service.auth.admin.listUsers({ perPage: 200 }),
    service
      .from("user_roles")
      .select("id, user_id, role, ministry_id, ministries(name, type), areas(name)"),
    service.from("ministries").select("id, name, type").order("type").order("name").returns<Ministry[]>(),
    svReadData(),
    service.from("areas").select("id, name, ministries(name)").order("name"),
  ]);
  const areaOptions = (areas ?? []).map((a) => ({ id: a.id, name: `${a.ministries?.name ?? ""} · ${a.name}` }))
    .sort((x, y) => x.name.localeCompare(y.name, "es"));

  const grupos: SvGrupo[] = Object.values(svData.grupos ?? {}).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es")
  );
  // Mapa userId → grupo que lidera
  const grupoByLeader = new Map<string, SvGrupo>();
  for (const g of grupos) {
    for (const uid of g.lider_user_ids ?? []) {
      grupoByLeader.set(uid, g);
    }
  }

  const emailById = new Map<string, string>();
  for (const u of authUsersData?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email);
  }

  // Agrupar user_roles por user_id
  const extraRolesByUser = new Map<string, ExtraRole[]>();
  for (const r of allUserRoles ?? []) {
    const list = extraRolesByUser.get(r.user_id) ?? [];
    list.push({
      id: r.id,
      role: r.role,
      ministry_id: r.ministry_id,
      ministry_name: r.ministries?.name ?? null,
      ministry_type: r.ministries?.type ?? null,
      area_name: r.areas?.name ?? null,
    });
    extraRolesByUser.set(r.user_id, list);
  }

  const rows = profiles ?? [];
  const pendingOf = (r: UserRow) => isPending(r, extraRolesByUser.get(r.id) ?? []);
  const pending = rows.filter(pendingOf);
  const others = rows.filter((r) => !pendingOf(r));

  return (
    <main className="min-h-dvh">
      <div className="px-4 pt-6 pb-10 max-w-2xl mx-auto flex flex-col gap-5">

        <header className="flex flex-col gap-1">
          <span className="eyebrow">Super admin</span>
          <h1 className="text-[26px] font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            Usuarios
          </h1>
        </header>

        {ok && (
          <p role="status" className="text-sm rounded-[var(--radius-control)] px-4 py-3"
            style={{ background: "var(--color-up-soft)", color: "var(--color-up)", border: "1px solid var(--color-up)" }}>
            {ok}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm rounded-[var(--radius-control)] px-4 py-3"
            style={{ background: "var(--color-down-soft)", color: "var(--color-down)", border: "1px solid var(--color-down)" }}>
            {error}
          </p>
        )}

        <InviteSection roles={[...ROLES]} inviteAction={inviteUserAction} />
        <UserSearch defaultValue={searchQuery} />

        {pending.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="eyebrow">Pendientes de revisión</span>
              <span className="text-[11px] font-semibold px-2 py-[2px] rounded-full"
                style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-text)" }}>
                {pending.length}
              </span>
            </div>
            {pending.map((p) => (
              <UserCard key={p.id} u={p} email={emailById.get(p.id)}
                extraRoles={extraRolesByUser.get(p.id) ?? []}
                ministries={ministries ?? []}
                grupos={grupos}
                areas={areaOptions}
                grupoActual={grupoByLeader.get(p.id) ?? null}
                highlight isSelf={p.id === user.id} />
            ))}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="eyebrow">
              {pending.length > 0 ? "Resto de usuarios" : "Todos los usuarios"}
            </span>
            <span className="text-[11px] font-semibold px-2 py-[2px] rounded-full"
              style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}>
              {searchQuery ? `${rows.length} resultados` : others.length}
            </span>
          </div>

          {others.length === 0 && (
            <p className="text-sm py-4 text-center" style={{ color: "var(--color-muted)" }}>
              {searchQuery ? `Sin resultados para "${searchQuery}"` : "Sin usuarios"}
            </p>
          )}

          {others.map((p) => (
            <UserCard key={p.id} u={p} email={emailById.get(p.id)}
              extraRoles={extraRolesByUser.get(p.id) ?? []}
              ministries={ministries ?? []}
              grupos={grupos}
              areas={areaOptions}
              grupoActual={grupoByLeader.get(p.id) ?? null}
              isSelf={p.id === user.id} />
          ))}
        </section>

      </div>
    </main>
  );
}

function UserCard({
  u, email, extraRoles, ministries, grupos, areas: areaOptions, grupoActual, highlight, isSelf,
}: {
  u: UserRow;
  email?: string;
  extraRoles: ExtraRole[];
  ministries: Ministry[];
  grupos: SvGrupo[];
  areas: { id: string; name: string }[];
  grupoActual: SvGrupo | null;
  highlight?: boolean;
  isSelf?: boolean;
}) {
  const hasDiscipuladoRole = extraRoles.some((r) => r.role === "lider_discipulado");

  return (
    <div
      className="card flex flex-col gap-3 px-4 py-3"
      style={highlight ? { borderColor: "var(--color-gold)", background: "var(--color-gold-soft)" } : undefined}
    >
      {/* Fila: avatar + nombre/email + rol primario */}
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold flex-none"
          style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
          aria-hidden="true"
        >
          {getInitials(u.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight" style={{ color: "var(--color-ink)" }}>
            {u.full_name}
            {isSelf && <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--color-faint)" }}>(tú)</span>}
          </p>
          <p className="text-xs truncate" style={{ color: "var(--color-muted)" }}>{email ?? u.id}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            <span className="text-[11px] font-semibold px-2 py-[2px] rounded-full whitespace-nowrap"
              style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
              {ROLE_LABELS[u.role] ?? u.role}
            </span>
            {!requestGranted(u, extraRoles) && (
              <span className="text-[11px] font-semibold px-2 py-[2px] rounded-full whitespace-nowrap"
                style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-text)" }}>
                Solicita: {REQUESTED_LABELS[u.requested_role!] ?? u.requested_role}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Roles adicionales */}
      {extraRoles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 sm:pl-11">
          {extraRoles.map((er) => (
            <div key={er.id} className="flex items-center gap-1">
              <span className="text-[11px] font-semibold px-2 py-[2px] rounded-full min-w-0"
                style={{ background: "var(--color-surface-2)", color: "var(--color-ink)" }}>
                {EXTRA_ROLE_LABELS[er.role] ?? er.role}
                {er.ministry_name ? ` · ${er.ministry_name}` : ""}
                {er.area_name ? ` · ${er.area_name}` : ""}
              </span>
              <form action={removeUserRoleAction}>
                <input type="hidden" name="role_id" value={er.id} />
                <button type="submit"
                  className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold transition flex-none"
                  style={{ background: "var(--color-line)", color: "var(--color-muted)" }}
                  aria-label={`Quitar rol ${er.role}`}>
                  <Icon name="close" size={16} label="Cerrar" />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {/* Agregar rol adicional */}
      <AddRoleForm
        userId={u.id}
        ministries={ministries}
        grupos={grupos}
        areas={areaOptions}
        addAction={addUserRoleAction}
      />

      {/* Cambiar rol primario */}
      <form action={updateUserRoleAction}
        className="flex items-center gap-2"
        style={{ borderTop: "1px solid var(--color-line)", paddingTop: 10 }}>
        <input type="hidden" name="user_id" value={u.id} />
        <select name="role" defaultValue={u.role} className="input flex-1 min-w-0 text-sm"
          style={{ height: 36, paddingTop: 0, paddingBottom: 0 }}
          disabled={isSelf} aria-label="Rol primario">
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <button type="submit" className="btn-primary flex-none text-sm"
          style={{ height: 36, padding: "0 14px" }} disabled={isSelf}>
          Guardar rol
        </button>
      </form>

      {isSelf && (
        <p className="text-xs pl-0" style={{ color: "var(--color-faint)" }}>
          No puedes cambiar tu propio rol. Pide a otro super admin o usa SQL.
        </p>
      )}

      {!isSelf && (
        <DeleteUserButton userId={u.id} fullName={u.full_name} deleteAction={deleteUserAction} />
      )}

      {/* Grupo de discipulado — solo para líderes de discipulado */}
      {hasDiscipuladoRole && (
        <div
          className="flex flex-col gap-2 pt-3"
          style={{ borderTop: "1px solid var(--color-line)" }}
        >
          <p className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>
            Grupo de discipulado
          </p>
          {grupoActual && (
            <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
              {grupoActual.nombre}
            </p>
          )}
          <form action={asignarGrupoAction} className="flex items-center gap-2">
            <input type="hidden" name="user_id" value={u.id} />
            <select
              name="grupo_id"
              defaultValue={grupoActual?.id ?? ""}
              className="input text-sm flex-1 min-w-0"
              style={{ height: 32, paddingTop: 0, paddingBottom: 0 }}
            >
              <option value="">— Sin grupo —</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="text-sm font-semibold flex-none px-3 rounded-[var(--radius-control)] transition"
              style={{
                height: 32,
                background: "var(--color-surface-2)",
                color: "var(--color-accent)",
                border: "1px solid var(--color-line)",
              }}
            >
              Asignar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

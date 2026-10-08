import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  inviteUserAction,
  updateUserRoleAction,
  addUserRoleAction,
  removeUserRoleAction,
} from "./actions";
import { UserSearch, InviteSection } from "./_components";

const ROLES = [
  { value: "leader", label: "Líder" },
  { value: "mentor", label: "Líder de discipulado" },
  { value: "pastor_ministerio", label: "Pastor de ministerio" },
  { value: "pastor_sede", label: "Pastor de sede" },
  { value: "admin_casa", label: "Admin de casa" },
  { value: "studio_admin", label: "Admin del Estudio" },
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
};

type Ministry = { id: string; name: string; type: string };

function isPending(r: UserRow): boolean {
  if (!r.requested_role) return false;
  if (r.requested_role === "lider_departamento" && r.role === "leader") return false;
  if (r.requested_role === r.role) return false;
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
  ] = await Promise.all([
    profileQuery.returns<UserRow[]>(),
    service.auth.admin.listUsers({ perPage: 200 }),
    service
      .from("user_roles")
      .select("id, user_id, role, ministry_id, ministries(name, type)"),
    service.from("ministries").select("id, name, type").order("type").order("name").returns<Ministry[]>(),
  ]);

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
    });
    extraRolesByUser.set(r.user_id, list);
  }

  const rows = profiles ?? [];
  const pending = rows.filter(isPending);
  const others = rows.filter((r) => !isPending(r));

  return (
    <main className="min-h-dvh" style={{ background: "var(--color-bg)" }}>
      <div className="px-4 pt-6 pb-10 max-w-2xl mx-auto flex flex-col gap-5">

        <header className="flex flex-col gap-1">
          <span className="eyebrow">Super admin</span>
          <h1 className="text-[26px] font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            Usuarios
          </h1>
        </header>

        {ok && (
          <p role="status" className="text-sm rounded-[10px] px-4 py-3"
            style={{ background: "var(--color-up-soft)", color: "var(--color-up)", border: "1px solid var(--color-up)" }}>
            {ok}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm rounded-[10px] px-4 py-3"
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
                ministries={ministries ?? []} highlight isSelf={p.id === user.id} />
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
              ministries={ministries ?? []} isSelf={p.id === user.id} />
          ))}
        </section>

      </div>
    </main>
  );
}

function UserCard({
  u, email, extraRoles, ministries, highlight, isSelf,
}: {
  u: UserRow;
  email?: string;
  extraRoles: ExtraRole[];
  ministries: Ministry[];
  highlight?: boolean;
  isSelf?: boolean;
}) {
  const depts = ministries.filter((m) => m.type === "departamento");
  const mins = ministries.filter((m) => m.type === "ministerio");

  return (
    <div
      className="card flex flex-col gap-3 px-4 py-3"
      style={highlight ? { borderColor: "var(--color-gold)", background: "var(--color-gold-soft)" } : undefined}
    >
      {/* Fila: avatar + nombre/email + rol primario */}
      <div className="flex items-center gap-3">
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
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end flex-none max-w-[220px]">
          <span className="text-[11px] font-semibold px-2 py-[2px] rounded-full whitespace-nowrap"
            style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
            {ROLE_LABELS[u.role] ?? u.role}
          </span>
          {u.requested_role && (
            <span className="text-[11px] font-semibold px-2 py-[2px] rounded-full whitespace-nowrap"
              style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-text)" }}>
              Solicita: {REQUESTED_LABELS[u.requested_role] ?? u.requested_role}
            </span>
          )}
        </div>
      </div>

      {/* Roles adicionales */}
      {extraRoles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-11">
          {extraRoles.map((er) => (
            <div key={er.id} className="flex items-center gap-1">
              <span className="text-[11px] font-semibold px-2 py-[2px] rounded-full"
                style={{ background: "var(--color-surface-2)", color: "var(--color-ink)" }}>
                {EXTRA_ROLE_LABELS[er.role] ?? er.role}
                {er.ministry_name ? ` · ${er.ministry_name}` : ""}
              </span>
              <form action={removeUserRoleAction}>
                <input type="hidden" name="role_id" value={er.id} />
                <button type="submit"
                  className="w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold transition"
                  style={{ background: "var(--color-line)", color: "var(--color-muted)" }}
                  aria-label={`Quitar rol ${er.role}`}>
                  ×
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {/* Agregar rol adicional */}
      <form action={addUserRoleAction} className="flex items-center gap-2 pl-11">
        <input type="hidden" name="user_id" value={u.id} />
        <select name="role" className="input text-sm flex-none"
          style={{ height: 32, paddingTop: 0, paddingBottom: 0, width: 170 }}>
          <option value="lider_departamento">Líder de departamento</option>
          <option value="pastor_ministerio">Pastor de ministerio</option>
          <option value="pastor_sede">Pastor de sede</option>
          <option value="lider_discipulado">Líder de discipulado</option>
        </select>
        <select name="ministry_id" className="input text-sm flex-1"
          style={{ height: 32, paddingTop: 0, paddingBottom: 0 }}>
          <option value="">— sin vincular —</option>
          {depts.length > 0 && (
            <optgroup label="Departamentos">
              {depts.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </optgroup>
          )}
          {mins.length > 0 && (
            <optgroup label="Ministerios">
              {mins.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </optgroup>
          )}
        </select>
        <button type="submit" className="text-sm font-semibold flex-none px-3 rounded-[8px] transition"
          style={{ height: 32, background: "var(--color-surface-2)", color: "var(--color-accent)", border: "1px solid var(--color-line)" }}>
          + Agregar
        </button>
      </form>

      {/* Cambiar rol primario */}
      <form action={updateUserRoleAction}
        className="flex items-center gap-2"
        style={{ borderTop: "1px solid var(--color-line)", paddingTop: 10 }}>
        <input type="hidden" name="user_id" value={u.id} />
        <select name="role" defaultValue={u.role} className="input flex-1 text-sm"
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
    </div>
  );
}

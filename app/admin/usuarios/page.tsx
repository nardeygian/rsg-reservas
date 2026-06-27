import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { inviteUserAction, updateUserRoleAction } from "./actions";

const ROLES = [
  { value: "leader", label: "Líder" },
  { value: "pastor_sede", label: "Pastor de sede" },
  { value: "admin_casa", label: "Admin de casa" },
  { value: "studio_admin", label: "Admin del Estudio" },
  { value: "super_admin", label: "Super admin" },
] as const;

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLES.map((r) => [r.value, r.label])
);

const REQUESTED_LABELS: Record<string, string> = {
  lider_departamento: "Líder de departamento",
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

function isPending(r: UserRow): boolean {
  return (
    !!r.requested_role &&
    r.requested_role !== "lider_departamento" &&
    r.role === "leader"
  );
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!me || me.role !== "super_admin") {
    redirect("/?error=Sin%20permiso");
  }

  const service = createServiceClient();
  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name, role, requested_role, created_at")
    .order("created_at", { ascending: false })
    .returns<UserRow[]>();

  const { data: authUsers } = await service.auth.admin.listUsers({
    perPage: 200,
  });
  const emailById = new Map<string, string>();
  for (const u of authUsers?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email);
  }

  const rows = profiles ?? [];
  const pending = rows.filter(isPending);
  const others = rows.filter((r) => !isPending(r));

  return (
    <main className="min-h-dvh px-4 py-4 max-w-2xl mx-auto space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="eyebrow">Super admin</p>
          <h1 className="font-serif text-2xl mt-1 tracking-[-0.02em]">
            Usuarios
          </h1>
        </div>
        <Link href="/admin" className="text-sm underline text-fg2">
          Admin
        </Link>
      </header>

      {ok && (
        <p
          role="status"
          className="text-sm rounded-[14px] px-4 py-3 border border-[color:var(--color-sage-200)] bg-sage-100"
        >
          {ok}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-sm rounded-[14px] px-4 py-3"
          style={{ background: "#f2e3dd", color: "var(--color-critical)" }}
        >
          {error}
        </p>
      )}

      <details className="card">
        <summary className="cursor-pointer font-serif text-xl">
          Invitar usuario
        </summary>
        <form action={inviteUserAction} className="space-y-3 mt-4">
          <p className="text-sm text-fg2">
            Le enviamos un correo con un enlace para que defina su
            contraseña. Útil para admin del Estudio, admin de casa o
            pastores de sede que no se registran solos.
          </p>
          <label className="block">
            <span className="eyebrow">Nombre completo</span>
            <input
              name="full_name"
              type="text"
              required
              className="input mt-2"
            />
          </label>
          <label className="block">
            <span className="eyebrow">Email</span>
            <input
              name="email"
              type="email"
              required
              className="input mt-2"
            />
          </label>
          <label className="block">
            <span className="eyebrow">Rol</span>
            <select
              name="role"
              required
              defaultValue="studio_admin"
              className="input mt-2"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary w-full">
            Enviar invitación
          </button>
        </form>
      </details>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="eyebrow">
            Pendientes de revisión · {pending.length}
          </h2>
          {pending.map((p) => (
            <UserCard
              key={p.id}
              u={p}
              email={emailById.get(p.id)}
              highlight
              isSelf={p.id === user.id}
            />
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="eyebrow">
          {pending.length > 0 ? "Resto de usuarios" : "Todos los usuarios"} ·{" "}
          {others.length}
        </h2>
        {others.map((p) => (
          <UserCard
            key={p.id}
            u={p}
            email={emailById.get(p.id)}
            isSelf={p.id === user.id}
          />
        ))}
      </section>
    </main>
  );
}

function UserCard({
  u,
  email,
  highlight,
  isSelf,
}: {
  u: UserRow;
  email?: string;
  highlight?: boolean;
  isSelf?: boolean;
}) {
  return (
    <div
      className={`rounded-[22px] border p-5 space-y-3 ${
        highlight
          ? "border-[color:#f3ecdc] bg-[#f3ecdc]/30"
          : "card"
      }`}
    >
      <div>
        <p className="font-semibold">
          {u.full_name}
          {isSelf && (
            <span className="ml-2 text-xs text-fg3">(tú)</span>
          )}
        </p>
        <p className="text-sm text-fg2">{email ?? u.id}</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-gray-500">Rol actual</dt>
        <dd>{ROLE_LABELS[u.role] ?? u.role}</dd>
        {u.requested_role && (
          <>
            <dt className="text-gray-500">Solicitó</dt>
            <dd>
              {REQUESTED_LABELS[u.requested_role] ?? u.requested_role}
            </dd>
          </>
        )}
      </dl>

      <form
        action={updateUserRoleAction}
        className="flex items-center gap-2"
      >
        <input type="hidden" name="user_id" value={u.id} />
        <select
          name="role"
          defaultValue={u.role}
          className="input flex-1"
          disabled={isSelf}
          aria-label="Rol"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="btn-primary"
          disabled={isSelf}
        >
          Guardar
        </button>
      </form>
      {isSelf && (
        <p className="text-xs text-fg3">
          No puedes cambiar tu propio rol desde aquí. Pide a otro super
          admin que lo haga, o usa SQL.
        </p>
      )}
    </div>
  );
}

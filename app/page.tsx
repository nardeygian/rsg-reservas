import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "./_components/ThemeToggle";

const ROLE_LABELS: Record<string, string> = {
  leader: "Líder",
  pastor_sede: "Pastor de sede",
  admin_casa: "Admin de casa",
  studio_admin: "Admin del Estudio",
  super_admin: "Super admin",
};

const REQUESTED_ROLE_LABELS: Record<string, string> = {
  lider_departamento: "Líder de departamento",
  pastor_ministerio: "Pastor de ministerio",
  pastor_sede: "Pastor de sede",
};

const STAFF_ROLES = ["pastor_sede", "admin_casa", "super_admin"];

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, requested_role")
    .eq("id", user.id)
    .single();

  const isStaff = !!profile && STAFF_ROLES.includes(profile.role);
  const { count: pendingCount } = isStaff
    ? await supabase
        .from("bookings_staff")
        .select("id", { count: "exact", head: true })
        .eq("status", "requested")
    : { count: null };

  return (
    <main className="min-h-dvh px-5 py-6 max-w-md mx-auto">
      <header className="flex items-baseline justify-between mb-8">
        <div>
          <p className="eyebrow">Iglesia RSG</p>
          <h1 className="font-serif text-3xl mt-1 tracking-[-0.02em]">
            Reservas
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <form action="/logout" method="post">
            <button
              type="submit"
              className="text-sm underline text-fg2 px-2 h-9"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <section className="card mb-4">
        <p className="eyebrow">Sesión activa</p>
        <p className="font-serif text-2xl mt-2">
          {profile?.full_name ?? user.email}
        </p>
        <p className="text-sm text-fg2 mt-1">
          {profile?.role
            ? (ROLE_LABELS[profile.role] ?? profile.role)
            : "—"}
        </p>
        {profile?.requested_role && profile.role === "leader" && (
          <p className="text-xs text-fg3 mt-3">
            Solicitaste:{" "}
            {REQUESTED_ROLE_LABELS[profile.requested_role] ??
              profile.requested_role}
            . Pendiente de revisión.
          </p>
        )}
      </section>

      <nav className="space-y-3">
        <a href="/calendario" className="btn-primary w-full">
          Ver calendario
        </a>

        {isStaff && (
          <a
            href="/aprobaciones"
            className="card card-hover flex items-center justify-between"
            style={{
              borderColor: "var(--color-line-strong)",
            }}
          >
            <span className="font-medium">Aprobaciones pendientes</span>
            <span
              className="rounded-full text-xs font-semibold px-2 py-0.5"
              style={{
                background: "var(--color-sand-200)",
                color: "var(--color-fg2)",
              }}
            >
              {pendingCount ?? 0}
            </span>
          </a>
        )}

        {isStaff && (
          <a
            href="/admin"
            className="card card-hover block text-sm text-center"
          >
            Administración
            <span className="text-fg3 block text-xs mt-0.5">
              Catálogo y tarifas
            </span>
          </a>
        )}

        <a href="/perfil" className="card card-hover block text-sm text-center">
          Mi perfil y suscripción al calendario
        </a>
      </nav>
    </main>
  );
}

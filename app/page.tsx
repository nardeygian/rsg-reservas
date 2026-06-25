import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    <main className="min-h-dvh px-4 py-10 max-w-md mx-auto">
      <header className="flex items-baseline justify-between mb-8">
        <h1 className="text-2xl font-semibold">RSG Reservas</h1>
        <form action="/logout" method="post">
          <button
            type="submit"
            className="text-sm underline text-gray-600 dark:text-gray-400"
          >
            Salir
          </button>
        </form>
      </header>

      <section className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-2">
        <p className="text-sm text-gray-500">Sesión activa</p>
        <p className="text-lg font-medium">
          {profile?.full_name ?? user.email}
        </p>
        <p className="text-sm">
          Rol:{" "}
          <strong>
            {profile?.role ? ROLE_LABELS[profile.role] ?? profile.role : "—"}
          </strong>
        </p>
        {profile?.requested_role && profile.role === "leader" && (
          <p className="text-xs text-gray-500">
            Solicitaste:{" "}
            {REQUESTED_ROLE_LABELS[profile.requested_role] ??
              profile.requested_role}
            . Pendiente de revisión por un administrador.
          </p>
        )}
      </section>

      <a
        href="/calendario"
        className="mt-8 block w-full rounded-md bg-black text-white py-3 text-center font-medium dark:bg-white dark:text-black"
      >
        Ver calendario
      </a>

      {isStaff && (
        <a
          href="/aprobaciones"
          className="mt-3 flex items-center justify-between w-full rounded-md border border-amber-300 dark:border-amber-800 px-4 py-3 text-amber-900 dark:text-amber-200"
        >
          <span className="font-medium">Aprobaciones pendientes</span>
          <span className="rounded-full bg-amber-200 dark:bg-amber-900 text-xs font-semibold px-2 py-0.5">
            {pendingCount ?? 0}
          </span>
        </a>
      )}

      <a
        href="/perfil"
        className="mt-3 block w-full rounded-md border border-gray-300 dark:border-gray-700 px-4 py-3 text-sm text-center"
      >
        Mi perfil y suscripción al calendario
      </a>
    </main>
  );
}

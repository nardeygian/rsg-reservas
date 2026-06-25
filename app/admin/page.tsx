import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const STAFF_ROLES = ["pastor_sede", "admin_casa", "super_admin"];

export default async function AdminLandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    redirect("/?error=Sin%20permiso");
  }

  return (
    <main className="min-h-dvh px-4 py-4 max-w-2xl mx-auto space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Administración</h1>
        <Link
          href="/"
          className="text-sm underline text-gray-600 dark:text-gray-400"
        >
          Inicio
        </Link>
      </header>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Gestión del catálogo de alquiler. Lo que configures acá se usará en las
        reservas externas (próxima fase).
      </p>

      <nav className="grid grid-cols-1 gap-3">
        <Link
          href="/admin/items"
          className="block rounded-md border border-gray-200 dark:border-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          <p className="font-medium">Items del catálogo</p>
          <p className="text-sm text-gray-500">
            Sillas, sonido, mesas, micrófonos. Cantidad disponible y precio.
          </p>
        </Link>
        <Link
          href="/admin/espacios"
          className="block rounded-md border border-gray-200 dark:border-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          <p className="font-medium">Espacios y tarifas</p>
          <p className="text-sm text-gray-500">
            Define la tarifa por hora de cada espacio. Sin tarifa = no se
            alquila por la plataforma.
          </p>
        </Link>
      </nav>
    </main>
  );
}

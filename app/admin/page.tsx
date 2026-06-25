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
        <div>
          <p className="eyebrow">Staff</p>
          <h1 className="font-serif text-2xl mt-1 tracking-[-0.02em]">
            Administración
          </h1>
        </div>
        <Link href="/" className="text-sm underline text-fg2">
          Inicio
        </Link>
      </header>

      <p className="text-sm text-fg2">
        Gestión del catálogo de alquiler. Lo que configures acá se usa en las
        reservas externas.
      </p>

      <nav className="grid grid-cols-1 gap-3">
        <Link href="/admin/items" className="card card-hover block">
          <p className="font-serif text-xl">Items del catálogo</p>
          <p className="text-sm text-fg2 mt-1">
            Sillas, sonido, mesas, micrófonos. Cantidad disponible y precio.
          </p>
        </Link>
        <Link href="/admin/espacios" className="card card-hover block">
          <p className="font-serif text-xl">Espacios y tarifas</p>
          <p className="text-sm text-fg2 mt-1">
            Define la tarifa por hora de cada espacio. Sin tarifa = no se
            alquila por la plataforma.
          </p>
        </Link>
      </nav>
    </main>
  );
}

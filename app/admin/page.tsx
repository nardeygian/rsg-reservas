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

  const sections = [
    {
      href: "/admin/items",
      title: "Items del catálogo",
      description: "Sillas, sonido, mesas, micrófonos. Cantidad disponible y precio.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
      ),
    },
    {
      href: "/admin/espacios",
      title: "Espacios y tarifas",
      description: "Define la tarifa por hora de cada espacio. Sin tarifa = no se alquila por la plataforma.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    ...(profile.role === "super_admin"
      ? [
          {
            href: "/admin/usuarios",
            title: "Usuarios",
            description: "Revisa solicitudes de rol y promueve usuarios a pastor de sede, admin de casa o admin del Estudio.",
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="8" r="3.5"/>
                <path d="M2.5 20a6.5 6.5 0 0 1 13 0"/>
                <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>
              </svg>
            ),
          },
        ]
      : []),
  ];

  return (
    <main className="min-h-dvh" style={{ background: "var(--color-bg)" }}>
      <div className="px-4 pt-6 pb-10 max-w-2xl mx-auto flex flex-col gap-5">

        <header className="flex flex-col gap-1">
          <span className="eyebrow">Administración</span>
          <h1
            className="text-[26px] font-bold leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Panel de administración
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
            Gestión del catálogo de alquiler. Lo que configures acá se usa en las reservas externas.
          </p>
        </header>

        <nav className="flex flex-col gap-3" aria-label="Secciones de administración">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="card card-hover flex items-center gap-4 px-4 py-4"
              style={{ textDecoration: "none" }}
            >
              <span
                className="w-10 h-10 rounded-[8px] flex items-center justify-center flex-none"
                style={{
                  background: "var(--color-accent-soft)",
                  color: "var(--color-accent)",
                }}
              >
                {s.icon}
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p
                  className="font-semibold text-sm"
                  style={{ color: "var(--color-ink)" }}
                >
                  {s.title}
                </p>
                <p
                  className="text-xs leading-snug"
                  style={{ color: "var(--color-muted)" }}
                >
                  {s.description}
                </p>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--color-faint)", flexShrink: 0, marginLeft: "auto" }}
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          ))}
        </nav>

      </div>
    </main>
  );
}

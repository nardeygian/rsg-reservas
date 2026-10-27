import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { svReadData } from "@/app/servicio/_lib/data";

export default async function PreviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") redirect("/?error=Sin+permiso");

  const svData = await svReadData();
  const grupos = Object.values(svData.grupos ?? {}).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es")
  );

  const eyeIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );

  const chevron = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-faint)", flexShrink: 0, marginLeft: "auto" }} aria-hidden="true">
      <path d="M9 18l6-6-6-6"/>
    </svg>
  );

  return (
    <main className="min-h-dvh">
      <div className="px-4 pt-6 pb-10 max-w-2xl mx-auto flex flex-col gap-6">

        <header className="flex flex-col gap-1">
          <span className="eyebrow">Super admin</span>
          <h1 className="text-[26px] font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            Vista previa de roles
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
            Navega a un módulo viendo exactamente lo que ve ese rol. Tu sesión no cambia.
          </p>
        </header>

        {/* Servidor de planeación */}
        <section className="flex flex-col gap-2">
          <p className="eyebrow">Servidor de planeación</p>
          <Link
            href="/servicio"
            className="card card-hover flex items-center gap-4 px-4 py-4"
            style={{ textDecoration: "none" }}
          >
            <span className="w-10 h-10 rounded-[var(--radius-control)] flex items-center justify-center flex-none" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
              {eyeIcon}
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>Módulo de Servicio</p>
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>Con acceso de edición — igual que planeación</p>
            </div>
            {chevron}
          </Link>
        </section>

        {/* Pastor de ministerio */}
        <section className="flex flex-col gap-2">
          <p className="eyebrow">Pastor de ministerio</p>
          <Link
            href="/servicio?preview=pastor"
            className="card card-hover flex items-center gap-4 px-4 py-4"
            style={{ textDecoration: "none" }}
          >
            <span className="w-10 h-10 rounded-[var(--radius-control)] flex items-center justify-center flex-none" style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}>
              {eyeIcon}
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>Módulo de Servicio</p>
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>Solo lectura — no puede editar asignaciones</p>
            </div>
            {chevron}
          </Link>
        </section>

        {/* Líder de discipulado */}
        <section className="flex flex-col gap-2">
          <p className="eyebrow">Líder de discipulado</p>
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>Elige el grupo que quieres previsualizar:</p>
          <div className="flex flex-col gap-2">
            {grupos.map((g) => (
              <Link
                key={g.id}
                href={`/discipulos?preview=lider&grupo=${g.id}`}
                className="card card-hover flex items-center gap-4 px-4 py-4"
                style={{ textDecoration: "none" }}
              >
                <span className="w-10 h-10 rounded-[var(--radius-control)] flex items-center justify-center flex-none text-sm font-bold" style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-text)" }}>
                  {g.nombre.slice(0, 2).toUpperCase()}
                </span>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>{g.nombre}</p>
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>Vista del líder — solo su grupo</p>
                </div>
                {chevron}
              </Link>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}

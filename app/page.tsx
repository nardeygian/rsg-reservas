import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { dayKey } from "@/lib/datetime";
import { ThemeToggle } from "./_components/ThemeToggle";
import { getCalendarEvents } from "@/lib/asana";

const ROLE_LABELS: Record<string, string> = {
  leader: "Líder",
  mentor: "Mentor",
  pastor_ministerio: "Pastor",
  pastor_sede: "Pastor",
  admin_casa: "Admin",
  studio_admin: "Admin Estudio",
  super_admin: "Admin",
};

const USE_TYPE_LABELS: Record<string, string> = {
  reunion_departamento: "Reunión de departamento",
  reunion_ministerio: "Reunión de ministerio",
  consejeria: "Consejería",
  discipulado: "Discipulado",
  evento: "Evento",
  externo: "Externo",
  studio_negocio: "Studio",
  otro: "Otro",
};

const APPROVER_ROLES = ["pastor_sede", "admin_casa", "super_admin", "pastor_ministerio", "studio_admin"];

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function formatDateEyebrow(date: Date): string {
  return date.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  });
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  if (dayKey(d) === dayKey(new Date())) return "Hoy";
  return d.toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    timeZone: "America/Bogota",
  });
}

function getGreeting(): string {
  const hour = parseInt(
    new Date().toLocaleString("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: "America/Bogota",
    }),
    10
  );
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function formatEventDay(due_on: string, todayStr: string): string {
  if (due_on === todayStr) return "Hoy";
  const d = new Date(due_on + "T12:00:00");
  return d
    .toLocaleDateString("es-CO", { weekday: "short" })
    .replace(".", "")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatShortTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("es-CO", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Bogota",
    })
    .replace(":00", "")
    .replace(" a. m.", " am")
    .replace(" p. m.", " pm");
}

export default async function HomePage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const { userId, email, profile } = session;

  const canApprove = !!profile && APPROVER_ROLES.includes(profile.role);
  const supabase = await createClient();
  const now = new Date();

  const [{ count: pendingCount }, { data: upcomingBookings }] = await Promise.all([
    canApprove
      ? supabase
          .from("bookings_staff")
          .select("id", { count: "exact", head: true })
          .eq("status", "requested")
      : Promise.resolve({ count: null as number | null }),
    supabase
      .from("bookings_calendar")
      .select("id, starts_at, ends_at, space_name, display_owner, status, use_type")
      .eq("created_by", userId)
      .in("status", ["approved", "requested"])
      .gte("starts_at", now.toISOString())
      .order("starts_at")
      .limit(3),
  ]);

  const calendarEvents = await getCalendarEvents().catch(() => [] as Awaited<ReturnType<typeof getCalendarEvents>>);

  const displayName = profile?.full_name ?? email ?? userId;
  const firstName = profile?.full_name?.split(" ")[0] ?? null;
  const roleLabel = profile?.role ? (ROLE_LABELS[profile.role] ?? null) : null;
  const today = new Date();
  const todayStr = today.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const weekEvents = calendarEvents
    .filter((e) => e.due_on >= todayStr && e.due_on <= weekEndStr)
    .slice(0, 4);

  return (
    <main className="min-h-dvh" style={{ background: "var(--color-bg)" }}>
      <div
        style={{
          padding: "28px clamp(16px, 4vw, 40px) 48px",
          maxWidth: 1180,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >

        {/* ── Encabezado ── */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 11,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--color-muted)",
                fontWeight: 600,
              }}
            >
              {formatDateEyebrow(today)}
            </span>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              {firstName ? `${getGreeting()}, ${firstName}` : "Portal RSG"}
            </h1>
          </div>

          {/* Chips + controles */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {roleLabel && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 99,
                  background: "var(--color-accent-soft)",
                  color: "var(--color-accent)",
                }}
              >
                {roleLabel}
              </span>
            )}
            {canApprove && (pendingCount ?? 0) > 0 && (
              <Link
                href="/aprobaciones"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 99,
                  background: "var(--color-gold-soft)",
                  color: "var(--color-gold-text)",
                  textDecoration: "none",
                }}
              >
                {pendingCount} por aprobar
              </Link>
            )}
            <ThemeToggle />
            <div
              className="avatar"
              style={{ width: 36, height: 36, fontSize: 13, fontWeight: 700, flexShrink: 0 }}
              aria-label={String(displayName)}
            >
              {getInitials(profile?.full_name)}
            </div>
          </div>
        </header>

        {/* ── Bloque Servicio (HOY EN RESURGENCIA) ── */}
        <section
          aria-label="Hoy en Resurgencia"
          style={{
            background: "var(--color-accent)",
            color: "#FFFFFF",
            borderRadius: 10,
            padding: 22,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: "14px 24px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  opacity: 0.85,
                }}
              >
                Hoy en Resurgencia
              </span>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 44,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  letterSpacing: "-.02em",
                  opacity: 0.4,
                }}
              >
                — reuniones
              </span>
            </div>
          </div>

          {/* Filas internas */}
          <div
            style={{
              borderRadius: 10,
              overflow: "hidden",
              background: "rgba(255,255,255,.2)",
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            <div
              style={{
                background: "var(--color-accent-dark)",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px 16px",
                flexWrap: "wrap",
                opacity: 0.6,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 17,
                    fontWeight: 600,
                  }}
                >
                  Módulo de Servicio
                </span>
                <span style={{ fontSize: 12.5, opacity: 0.88 }}>
                  Listados · asistencia · equipo · próximamente
                </span>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "10px 16px",
                  border: "1px solid rgba(255,255,255,.4)",
                  borderRadius: 8,
                  minHeight: 44,
                  boxSizing: "border-box",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Próximamente
              </span>
            </div>
          </div>
        </section>

        {/* ── Grid de módulos ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >

          {/* Mi discipulado — próximamente */}
          <section
            className="card"
            style={{
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              opacity: 0.5,
              pointerEvents: "none",
            }}
            aria-hidden="true"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>
                Mi discipulado · octubre
              </h2>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-accent)" }}>Ver</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {[["—", "sirvieron"], ["—", "en reuniones"], ["—", "Servolución"]].map(([n, l]) => (
                <div
                  key={l}
                  style={{
                    border: "1px solid var(--color-line)",
                    borderRadius: 10,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700 }}>{n}</span>
                  <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{l}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid var(--color-line)", paddingTop: 12 }}>
              <span style={{ color: "var(--color-muted)" }}>Aportes del discipulado</span>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17 }}>$ —</span>
            </div>
          </section>

          {/* Donaciones — próximamente */}
          <section
            className="card"
            style={{
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              opacity: 0.5,
              pointerEvents: "none",
            }}
            aria-hidden="true"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>
                Donaciones · octubre
              </h2>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-accent)" }}>Abrir</span>
            </div>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: "-.02em",
                lineHeight: 1.1,
              }}
            >
              $ —
            </span>
            <div
              style={{
                background: "var(--color-surface-2)",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 13,
                color: "var(--color-muted)",
              }}
            >
              Próximamente
            </div>
          </section>

          {/* Mis reservas — activo */}
          <section
            className="card"
            style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>
                Mis reservas
              </h2>
              <Link
                href="/reservas"
                style={{ fontSize: 13, fontWeight: 600, textDecoration: "none", color: "var(--color-accent)" }}
              >
                Reservar
              </Link>
            </div>

            {(upcomingBookings ?? []).length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {(upcomingBookings ?? []).slice(0, 2).map((b, i) => {
                  const isToday = b.starts_at ? dayKey(new Date(b.starts_at)) === dayKey(new Date()) : false;
                  const isApproved = b.status === "approved";
                  const dayStr = b.starts_at ? formatDayLabel(b.starts_at) : "";
                  const timeStr = b.starts_at ? formatShortTime(b.starts_at) : "";
                  return (
                    <div
                      key={b.id}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        paddingBottom: i === 0 && (upcomingBookings?.length ?? 0) > 1 ? 12 : 0,
                        paddingTop: i > 0 ? 12 : 0,
                        borderBottom:
                          i === 0 && (upcomingBookings?.length ?? 0) > 1
                            ? "1px solid var(--color-line)"
                            : "none",
                      }}
                    >
                      {/* Date square */}
                      <div
                        style={{
                          width: 48,
                          flexShrink: 0,
                          textAlign: "center",
                          borderRadius: 8,
                          background: isToday ? "var(--color-accent-soft)" : "var(--color-surface-2)",
                          color: isToday ? "var(--color-accent)" : "#3E4A45",
                          padding: "6px 0",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
                          {dayStr}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            fontSize: 15,
                          }}
                        >
                          {timeStr}
                        </span>
                      </div>

                      {/* Info */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                        <b style={{ fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {b.space_name}
                        </b>
                        <span style={{ fontSize: 13, color: "var(--color-muted)" }}>
                          {b.use_type ? (USE_TYPE_LABELS[b.use_type] ?? b.use_type) : (b.display_owner ?? "")}
                        </span>
                      </div>

                      {/* Status chip */}
                      <span
                        style={{
                          marginLeft: "auto",
                          flexShrink: 0,
                          fontSize: 11.5,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: isApproved ? "var(--color-accent-soft)" : "var(--color-gold-soft)",
                          color: isApproved ? "var(--color-accent)" : "var(--color-gold-text)",
                        }}
                      >
                        {isApproved ? "Aprobada" : "Pendiente"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--color-muted)" }}>
                  Sin reservas próximas
                </p>
                <Link
                  href="/reservas/nueva"
                  style={{ fontSize: 13, fontWeight: 600, textDecoration: "none", color: "var(--color-accent)" }}
                >
                  + Nueva reserva
                </Link>
              </div>
            )}
          </section>

          {/* Esta semana en el calendario */}
          <section
            className="card"
            style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>
                Esta semana
              </h2>
              <Link
                href="/calendario"
                style={{ fontSize: 13, fontWeight: 600, textDecoration: "none", color: "var(--color-accent)" }}
              >
                Ver todo
              </Link>
            </div>
            {weekEvents.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {weekEvents.map((event) => (
                  <div key={event.gid} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                    <span
                      style={{
                        width: 40,
                        flexShrink: 0,
                        fontSize: 12.5,
                        color: "var(--color-muted)",
                        fontWeight: 600,
                      }}
                    >
                      {formatEventDay(event.due_on, todayStr)}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <b
                        style={{
                          fontSize: 14,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {event.name}
                      </b>
                      {event.category && (
                        <span style={{ fontSize: 12.5, color: "var(--color-muted)" }}>
                          {event.category}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "var(--color-muted)" }}>
                Sin eventos esta semana
              </p>
            )}
          </section>

        </div>
      </div>
    </main>
  );
}

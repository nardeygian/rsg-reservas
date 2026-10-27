import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, getUserCaps } from "@/lib/auth";
import { dayKey, startOfDayBogota, endOfDayBogota } from "@/lib/datetime";
import { getCalendarEvents } from "@/lib/asana";
import { svReadData } from "@/app/servicio/_lib/data";
import { donReadData } from "@/app/donaciones/_lib/data";
import { donantes } from "@/app/donaciones/_lib/don-logic";
import { svNorm, svServiciosGrupo, svTablaDiscipulos, svEnPeriodo, periodoActual, MESES } from "@/app/servicio/_lib/sv-logic";

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
  const [session, caps] = await Promise.all([getSessionProfile(), getUserCaps()]);
  if (!session) redirect("/login");
  const { userId, email, profile } = session;

  const supabase = await createClient();
  let canApprove = !!profile && APPROVER_ROLES.includes(profile.role);
  if (!canApprove) {
    const { data: extraRoles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    canApprove = (extraRoles ?? []).some((r) => r.role === "pastor_ministerio" || r.role === "pastor_sede");
  }
  const now = new Date();

  const todayStart = startOfDayBogota(now);
  const todayEnd   = endOfDayBogota(now);

  const [{ count: pendingCount }, { data: upcomingBookings }, { count: bookingsTodayCount }, svData, donaciones, calendarEvents] = await Promise.all([
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
    supabase
      .from("bookings_calendar")
      .select("id", { count: "exact", head: true })
      .in("status", ["approved", "requested"])
      .gte("starts_at", todayStart.toISOString())
      .lt("starts_at", todayEnd.toISOString()),
    svReadData(),
    donReadData(),
    getCalendarEvents().catch(() => [] as Awaited<ReturnType<typeof getCalendarEvents>>),
  ]);

  const firstName = profile?.full_name?.split(" ")[0] ?? null;
  const today = new Date();
  const todayStr = today.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

  // Servicio + Donaciones
  const isAdmin = ["super_admin", "pastor_sede"].includes(profile?.role ?? "");
  const { y: perY, i: perI } = periodoActual("mes");
  const mesLabel = MESES[perI].charAt(0).toUpperCase() + MESES[perI].slice(1);
  const reunionesToday = Object.values(svData.reuniones ?? {}).filter(r => r.fecha === todayStr).length;

  const myGroup = Object.values(svData.grupos ?? {}).find(g => g.lider_user_ids.includes(userId)) ?? null;
  let groupStats: { sirvieron: number; totMin: number; totServ: number; total: number } | null = null;
  let groupDonTotal = 0;
  if (myGroup) {
    const miembros = Object.values(svData.miembros ?? {}).filter(m => m.grupo_id === myGroup.id);
    const servicios = svServiciosGrupo(svData, myGroup.id);
    const { sirvieron, totMin, totServ } = svTablaDiscipulos(miembros, servicios, "mes", perY, perI);
    const memberIds = new Set(miembros.map(m => m.id));
    const nameToId = new Map(miembros.map(m => [svNorm(m.nombre), m.id]));
    groupDonTotal = donaciones
      .filter(d => {
        const diId = d.di ?? nameToId.get(svNorm(d.n)) ?? null;
        return diId && memberIds.has(diId) && svEnPeriodo(d.f.slice(0, 10), "mes", perY, perI);
      })
      .reduce((sum, d) => sum + (d.m ?? 0), 0);
    groupStats = { sirvieron, totMin, totServ, total: miembros.length };
  }

  const donMes = donaciones.filter(d => svEnPeriodo(d.f.slice(0, 10), "mes", perY, perI));
  const donTotalMes = isAdmin ? donMes.reduce((sum, d) => sum + (d.m ?? 0), 0) : groupDonTotal;
  const donCountMes = donMes.length;
  const donantesCountMes = donantes(donMes);
  const donPromedioMes = donCountMes > 0 ? Math.round(donTotalMes / donCountMes) : 0;

  // Sum donations for all discipulado groups. Uses d.di first (authoritative from PHP panel),
  // then falls back to name matching so the Líderes y pastores group (whose members have no d.di)
  // is included. Each donation is one record so there is no double-counting even when a person
  // appears in multiple groups.
  const allMiembros = Object.values(svData.miembros ?? {});
  const allMemberIds = new Set(allMiembros.map(m => m.id));
  const allNameToId = new Map<string, string>();
  for (const m of allMiembros) {
    if (!allNameToId.has(svNorm(m.nombre))) allNameToId.set(svNorm(m.nombre), m.id);
  }
  const allGroupsDonTotal = donaciones
    .filter(d => {
      if (!svEnPeriodo(d.f.slice(0, 10), "mes", perY, perI)) return false;
      const diId = d.di ?? allNameToId.get(svNorm(d.n)) ?? null;
      return diId !== null && allMemberIds.has(diId);
    })
    .reduce((sum, d) => sum + (d.m ?? 0), 0);
  const fmtCOP = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

  const allGruposCount = Object.keys(svData.grupos ?? {}).length;

  // Last reunion for the Módulo de Servicio card
  const ultimaReunion = Object.values(svData.reuniones ?? {})
    .filter(r => r.fecha <= todayStr)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] ?? null;
  const ultimaReg = ultimaReunion ? (svData.registros?.[ultimaReunion.id] ?? null) : null;
  const ultimaServidores = ultimaReg ? ultimaReg.filas.filter(f => !f.aus).length : null;
  const ultimaAusencias = ultimaReg ? ultimaReg.filas.filter(f => f.aus).length : null;

  function formatFechaCorta(iso: string): string {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota" });
  }

  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const weekEvents = calendarEvents
    .filter((e) => e.due_on >= todayStr && e.due_on <= weekEndStr)
    .slice(0, 4);

  return (
    <main className="min-h-dvh">
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

          {/* Solo lo accionable: aprobaciones pendientes. Rol, tema y perfil viven en "Tú". */}
          {canApprove && (pendingCount ?? 0) > 0 && (
            <Link href="/aprobaciones" prefetch className="chip chip-gold" style={{ textDecoration: "none" }}>
              {pendingCount} por aprobar
            </Link>
          )}
        </header>

        {/* ── Bloque Servicio (HOY EN RESURGENCIA) ── */}
        <section
          aria-label="Hoy en Resurgencia"
          className="brand-hero"
          style={{ padding: 24, display: "flex", flexDirection: "column", gap: 22 }}
        >
          {/* Monograma de fondo, como el arco del deck */}
          <span
            aria-hidden
            className="brand-mark"
            style={{ position: "absolute", right: -28, top: -36, width: 220, color: "#F6F5F1", opacity: 0.07, zIndex: -1 }}
          />
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
                  fontSize: reunionesToday > 0 ? 40 : 26,
                  fontWeight: 600,
                  lineHeight: 1.1,
                  letterSpacing: "-.03em",
                }}
              >
                {reunionesToday > 0
                  ? `${reunionesToday} ${reunionesToday === 1 ? "reunión hoy" : "reuniones hoy"}`
                  : "Hoy es un día tranquilo"}
              </span>
              {(bookingsTodayCount ?? 0) > 0 && (
                <span style={{ fontSize: 15, fontWeight: 500, opacity: 0.8, marginTop: 2 }}>
                  {bookingsTodayCount === 1 ? "1 reserva" : `${bookingsTodayCount} reservas`} en la casa
                </span>
              )}
            </div>
          </div>

          {/* Donaciones en la franja */}
          {(isAdmin || donTotalMes > 0) && caps?.donaciones !== "none" && (
            <div className="brand-hero-tile" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, opacity: 0.85, color: "#fff" }}>
                  Recaudado en el mes
                </span>
                <Link href="/donaciones" style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", textDecoration: "none", opacity: 0.9 }}>
                  Ver registro →
                </Link>
              </div>
              <span className="tabular" style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 600, letterSpacing: "-.035em", lineHeight: 1.05, color: "#fff" }}>
                {donTotalMes > 0 ? fmtCOP(donTotalMes) : "$ —"}
              </span>
              {isAdmin && donCountMes > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {([
                    [String(donCountMes), "donaciones"],
                    [String(donantesCountMes), "donantes"],
                    [donPromedioMes >= 1000000
                      ? `$${(donPromedioMes / 1000000).toFixed(1).replace(".", ",")} M`
                      : `$${Math.round(donPromedioMes / 1000)} mil`, "promedio"],
                  ] as [string, string][]).map(([v, l]) => (
                    <div key={l} style={{ borderLeft: "1px solid rgba(233,231,226,.22)", padding: "2px 0 2px 12px" }}>
                      <div className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "clamp(16px, 4.6vw, 20px)", letterSpacing: "-.02em", color: "#fff", whiteSpace: "nowrap" }}>{v}</div>
                      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.75)", marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Grid de módulos ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >

          {/* Módulo de Servicio */}
          {caps?.servicio !== "none" && <div
            className="card"
            style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>Módulo de Servicio</h2>
                <span style={{ fontSize: 12.5, color: "var(--color-muted)" }}>Listados · asistencia · equipo</span>
              </div>
              <Link href="/servicio" style={{ fontSize: 12, fontWeight: 700, padding: "10px 16px", border: "1px solid var(--color-line)", borderRadius: "var(--radius-control)", flexShrink: 0, color: "var(--color-accent)", textDecoration: "none" }}>
                Abrir
              </Link>
            </div>
            {ultimaReunion && (
              <div style={{ borderTop: "1px solid var(--color-line)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", fontWeight: 600, color: "var(--color-muted)" }}>
                    Última reunión
                  </span>
                  <Link href={`/servicio?rid=${ultimaReunion.id}`} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-accent)", textDecoration: "none" }}>
                    Ver detalle →
                  </Link>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{ultimaReunion.nombre}</span>
                <span style={{ fontSize: 12.5, color: "var(--color-muted)" }}>{formatFechaCorta(ultimaReunion.fecha)}</span>
                {(ultimaServidores !== null || ultimaAusencias !== null) && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {ultimaServidores !== null && (
                      <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
                        {ultimaServidores} sirvieron
                      </span>
                    )}
                    {ultimaAusencias !== null && ultimaAusencias > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: "var(--color-gold-soft)", color: "var(--color-gold-text)" }}>
                        {ultimaAusencias} ausencias
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>}

          {/* Mi discipulado */}
          {caps?.discipulos && <section className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>
                {myGroup ? myGroup.nombre : isAdmin ? "Discípulos" : "Mis discípulos"} · {mesLabel}
              </h2>
              <Link
                href="/discipulos"
                style={{ fontSize: 13, fontWeight: 600, textDecoration: "none", color: "var(--color-accent)" }}
              >
                Ver
              </Link>
            </div>
            {groupStats ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                  {([
                    [String(groupStats.sirvieron), "sirvieron"],
                    [String(groupStats.totMin), "en reuniones"],
                    [String(groupStats.totServ), "Servolución"],
                  ] as [string, string][]).map(([n, l]) => (
                    <div
                      key={l}
                      style={{ border: "1px solid var(--color-line)", borderRadius: "var(--radius-control)", padding: 12, display: "flex", flexDirection: "column", gap: 2 }}
                    >
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700 }}>{n}</span>
                      <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{l}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid var(--color-line)", paddingTop: 12 }}>
                  <span style={{ color: "var(--color-muted)" }}>Aportes del discipulado</span>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17 }}>
                    {groupDonTotal > 0 ? fmtCOP(groupDonTotal) : "$ —"}
                  </span>
                </div>
              </>
            ) : isAdmin ? (
              <>
                <p style={{ margin: 0, fontSize: 13, color: "var(--color-muted)" }}>
                  {allGruposCount} grupos registrados
                </p>
                {allGroupsDonTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid var(--color-line)", paddingTop: 12 }}>
                    <span style={{ fontSize: 13, color: "var(--color-muted)" }}>Aportes del mes</span>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17 }}>
                      {fmtCOP(allGroupsDonTotal)}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "var(--color-muted)" }}>
                Sin grupo asignado
              </p>
            )}
          </section>}

          {/* Esta semana en el calendario */}
          {caps?.calendario && <section
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
          </section>}

          {/* Mis reservas — activo */}
          {caps?.reservas && <section
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
                          borderRadius: "var(--radius-control)",
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
          </section>}

        </div>
      </div>
    </main>
  );
}

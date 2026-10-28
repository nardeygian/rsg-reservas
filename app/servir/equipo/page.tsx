import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import { clienteServir, type ClienteServir } from "./_lib/supabase";
import { datosEquipo, fechaCorta, fechaReunion, misEquipos, reunionesProximas, type Equipo } from "./_lib/datos";
import { EquipoSelector } from "./_components/EquipoSelector";
import { MiembrosVista } from "./_components/MiembrosVista";
import { PosicionesVista } from "./_components/PosicionesVista";
import { SolicitudesVista } from "./_components/SolicitudesVista";

const VISTAS = [
  { id: "miembros", texto: "Miembros" },
  { id: "posiciones", texto: "Posiciones" },
  { id: "reuniones", texto: "Asignar" },
  { id: "solicitudes", texto: "Solicitudes" },
] as const;
type Vista = (typeof VISTAS)[number]["id"];

export default async function MiEquipoPage({ searchParams }: { searchParams: Promise<{ equipo?: string; vista?: string }> }) {
  const db = await clienteServir();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims.sub) redirect("/login");

  const equipos = await misEquipos(db);
  if (equipos.length === 0) redirect("/servir/mis-servicios");

  const params = await searchParams;
  const equipo = equipos.find((e) => e.key === params.equipo) ?? equipos[0];
  // Las solicitudes son por departamento: un líder de área no las ve.
  const vistas = VISTAS.filter((v) => v.id !== "solicitudes" || !equipo.area_id);
  const vista: Vista = vistas.some((v) => v.id === params.vista) ? (params.vista as Vista) : "miembros";
  const { count: porResponder } = equipo.area_id
    ? { count: 0 }
    : await db.from("team_join_requests").select("id", { count: "exact", head: true })
        .eq("ministry_id", equipo.ministry_id).eq("status", "pendiente");
  const qs = (v: Vista) => `/servir/equipo?equipo=${encodeURIComponent(equipo.key)}&vista=${v}`;

  return (
    <main className="min-h-dvh px-4 pt-6 max-w-[1180px] mx-auto w-full flex flex-col gap-4" style={{ paddingBottom: "calc(var(--nav-space) + 24px)" }}>
      <header className="flex flex-col gap-1">
        <p className="eyebrow">{equipo.area_name ? `Líder de área · ${equipo.ministry_name}` : "Líder de departamento"}</p>
        <h1 className="page-title">{equipo.area_name ?? equipo.ministry_name}</h1>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <nav className="segmented" aria-label="Secciones de Mi equipo">
          {vistas.map((v) => (
            <Link key={v.id} href={qs(v.id)} className="segmented-link" aria-current={vista === v.id ? "page" : undefined}>
              {v.texto}{v.id === "solicitudes" && (porResponder ?? 0) > 0 ? ` (${porResponder})` : ""}
            </Link>
          ))}
        </nav>
        <EquipoSelector equipos={equipos} actual={equipo.key} vista={vista} />
      </div>

      {vista === "reuniones" ? <Reuniones db={db} equipo={equipo} />
        : vista === "solicitudes" ? <Solicitudes db={db} equipo={equipo} />
        : <EquipoDatos db={db} equipo={equipo} vista={vista} />}
    </main>
  );
}

async function EquipoDatos({ db, equipo, vista }: { db: ClienteServir; equipo: Equipo; vista: Vista }) {
  const datos = await datosEquipo(db, equipo);
  return vista === "posiciones"
    ? <PosicionesVista equipo={equipo} posiciones={datos.posiciones} areas={datos.areas} />
    : <MiembrosVista equipo={equipo} miembros={datos.miembros} posiciones={datos.posiciones} areas={datos.areas} personas={datos.personas} />;
}

async function Solicitudes({ db, equipo }: { db: ClienteServir; equipo: Equipo }) {
  const { data } = await db.from("team_join_requests")
    .select("id, full_name, message, created_at")
    .eq("ministry_id", equipo.ministry_id).eq("status", "pendiente").order("created_at");
  return (
    <SolicitudesVista
      solicitudes={(data ?? []).map((s) => ({
        id: s.id,
        nombre: s.full_name,
        mensaje: s.message,
        fecha: fechaCorta(s.created_at.slice(0, 10)),
      }))}
    />
  );
}

async function Reuniones({ db, equipo }: { db: ClienteServir; equipo: Equipo }) {
  const reuniones = await reunionesProximas(db, equipo);
  if (reuniones.length === 0) {
    return <p className="card px-4 py-6 text-sm text-center" style={{ color: "var(--color-muted)" }}>No hay reuniones en los próximos dos meses.</p>;
  }
  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {reuniones.map((r) => {
        const total = r.aceptadas + r.pendientes + r.rechazadas;
        return (
          <li key={r.id}>
            <Link href={`/servir/equipo/reunion/${r.id}?equipo=${encodeURIComponent(equipo.key)}`} className="card card-hover px-4 py-3 flex items-center gap-3 min-h-[72px]">
              <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-[13px] font-medium capitalize" style={{ color: "var(--color-muted)" }}>{fechaReunion(r.meeting_date, r.starts_at)}</span>
                <span className="text-[15px] font-semibold truncate" style={{ color: "var(--color-ink)" }}>{r.name}</span>
                <span className="flex flex-wrap gap-1">
                  {total === 0 && <span className="chip chip-muted">Sin asignar</span>}
                  {r.aceptadas > 0 && <span className="chip chip-up">{r.aceptadas} {r.aceptadas === 1 ? "aceptó" : "aceptaron"}</span>}
                  {r.pendientes > 0 && <span className="chip chip-gold">{r.pendientes} sin responder</span>}
                  {r.rechazadas > 0 && <span className="chip chip-down">{r.rechazadas} {r.rechazadas === 1 ? "rechazó" : "rechazaron"}</span>}
                  {r.status === "borrador" && <span className="chip chip-muted">Borrador</span>}
                </span>
              </span>
              <Icon name="chevron-right" style={{ color: "var(--color-faint)" }} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

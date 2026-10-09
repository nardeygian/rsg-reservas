import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCalendarEvents } from "@/lib/asana";
import { CalendarioShell } from "./_components/CalendarioShell";
import { linkEventAction, unlinkEventAction } from "./actions";

export type LinkInfo = {
  booking_id: string;
  space_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

export type BookingOption = {
  id: string;
  space_name: string | null;
  starts_at: string;
  ends_at: string;
};

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();

  // Determinar si el usuario puede enlazar reuniones con reservas
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  let canLink = ["pastor_sede", "pastor_ministerio", "super_admin"].includes(profile?.role ?? "");
  if (!canLink) {
    const { data: extraRoles } = await supabase
      .from("user_roles")
      .select("role, ministries(name)")
      .eq("user_id", user.id);
    canLink = (extraRoles ?? []).some(
      (r) => r.role === "lider_departamento" && (r.ministries as { name: string } | null)?.name === "Planeación"
    );
  }

  // Eventos de Asana, links actuales y opciones de reserva (en paralelo)
  const [events, { data: linksRaw }, { data: bookingsRaw }] = await Promise.all([
    getCalendarEvents(),
    service.from("calendar_links").select("asana_gid, booking_id"),
    service
      .from("bookings_calendar")
      .select("id, space_name, starts_at, ends_at")
      .eq("status", "approved")
      .gte("starts_at", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
      .order("starts_at")
      .limit(300),
  ]);

  // Mapa booking_id → detalles
  const bookingById = new Map<string, { space_name: string | null; starts_at: string | null; ends_at: string | null }>();
  for (const b of bookingsRaw ?? []) {
    if (!b.id) continue;
    bookingById.set(b.id, { space_name: b.space_name, starts_at: b.starts_at, ends_at: b.ends_at });
  }

  // Links por asana_gid
  const linksByGid: Record<string, LinkInfo> = {};
  for (const link of linksRaw ?? []) {
    const detail = bookingById.get(link.booking_id);
    linksByGid[link.asana_gid] = {
      booking_id: link.booking_id,
      space_name: detail?.space_name ?? null,
      starts_at: detail?.starts_at ?? null,
      ends_at: detail?.ends_at ?? null,
    };
  }

  const bookingOptions: BookingOption[] = (bookingsRaw ?? [])
    .filter((b): b is typeof b & { id: string; starts_at: string } => !!b.id && !!b.starts_at)
    .map((b) => ({
      id: b.id,
      space_name: b.space_name,
      starts_at: b.starts_at,
      ends_at: b.ends_at ?? "",
    }));

  return (
    <main className="min-h-dvh" style={{ background: "var(--color-bg)" }}>
      {(ok || error) && (
        <div className="px-4 pt-4 max-w-3xl mx-auto">
          {ok && (
            <p className="text-sm rounded-[10px] px-4 py-3 mb-2"
              style={{ background: "var(--color-up-soft)", color: "var(--color-up)", border: "1px solid var(--color-up)" }}>
              {ok}
            </p>
          )}
          {error && (
            <p className="text-sm rounded-[10px] px-4 py-3 mb-2"
              style={{ background: "var(--color-down-soft)", color: "var(--color-down)", border: "1px solid var(--color-down)" }}>
              {error}
            </p>
          )}
        </div>
      )}
      <CalendarioShell
        events={events}
        linksByGid={linksByGid}
        bookingOptions={bookingOptions}
        canLink={canLink}
        linkAction={linkEventAction}
        unlinkAction={unlinkEventAction}
      />
    </main>
  );
}

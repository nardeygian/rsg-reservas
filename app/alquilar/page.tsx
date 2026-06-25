import { createServiceClient } from "@/lib/supabase/service";
import {
  nextHourBogota,
  toDatetimeLocalBogota,
} from "@/lib/datetime";
import { RentalForm } from "./_components/RentalForm";

type AvailRow = { item_id: string; name: string; available: number };

export const dynamic = "force-dynamic";

export default async function AlquilarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Usamos service_role en el server para leer el catálogo sin exponer
  // toda la table a anon. Solo enviamos al cliente los campos públicos.
  const admin = createServiceClient();

  const { data: spacesRaw } = await admin
    .from("spaces")
    .select("id, name, hourly_rate_cents, status")
    .eq("status", "active")
    .not("hourly_rate_cents", "is", null)
    .order("name");

  const spaces = (spacesRaw ?? [])
    .filter((s) => s.hourly_rate_cents != null)
    .map((s) => ({
      id: s.id,
      name: s.name,
      hourly_rate_cents: s.hourly_rate_cents as number,
    }));

  const { data: items } = await admin
    .from("rentable_items")
    .select("id, name, description, unit_price_cents, total_quantity")
    .eq("active", true)
    .order("name");

  const startDefault = nextHourBogota();
  const endDefault = new Date(startDefault.getTime() + 2 * 60 * 60 * 1000);

  // Disponibilidad inicial para la franja default. El form la refresca en
  // cliente al cambiar el horario.
  const { data: initialAvail } = await admin.rpc("items_available", {
    _starts: startDefault.toISOString(),
    _ends: endDefault.toISOString(),
  });
  const initialAvailability: Record<string, number> = Object.fromEntries(
    ((initialAvail ?? []) as AvailRow[]).map((a) => [a.item_id, a.available])
  );

  return (
    <main className="min-h-dvh px-4 py-6 max-w-md mx-auto space-y-6">
      <header>
        <p className="eyebrow">Iglesia RSG</p>
        <h1 className="font-serif text-3xl mt-1 tracking-[-0.02em]">
          Alquilar un espacio
        </h1>
        <p className="text-sm text-fg2 mt-2 leading-relaxed">
          Reserva espacios de RSG para tu evento. Tu reserva quedará aprobada
          una vez confirmemos el pago.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="text-sm rounded-[14px] px-4 py-3"
          style={{
            background: "#f2e3dd",
            color: "var(--color-critical)",
          }}
        >
          {error}
        </p>
      )}

      {spaces.length === 0 ? (
        <p className="text-sm rounded-[14px] border border-line px-4 py-3 bg-bg-elev">
          Por ahora no hay espacios disponibles para alquilar. Vuelve más tarde.
        </p>
      ) : (
        <RentalForm
          spaces={spaces}
          items={items ?? []}
          initialAvailability={initialAvailability}
          defaultStart={toDatetimeLocalBogota(startDefault)}
          defaultEnd={toDatetimeLocalBogota(endDefault)}
        />
      )}
    </main>
  );
}

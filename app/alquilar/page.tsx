import { createServiceClient } from "@/lib/supabase/service";
import {
  nextHourBogota,
  toDatetimeLocalBogota,
} from "@/lib/datetime";
import { RentalForm } from "./_components/RentalForm";

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

  return (
    <main className="min-h-dvh px-4 py-6 max-w-md mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Alquilar un espacio</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Reserva espacios de RSG para tu evento. Te confirmamos cuando el
          pastor verifique el pago.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="text-sm rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 px-3 py-2"
        >
          {error}
        </p>
      )}

      {spaces.length === 0 ? (
        <p className="text-sm rounded-md border border-gray-200 dark:border-gray-800 px-3 py-3">
          Por ahora no hay espacios disponibles para alquilar. Vuelve más tarde.
        </p>
      ) : (
        <RentalForm
          spaces={spaces}
          items={items ?? []}
          defaultStart={toDatetimeLocalBogota(startDefault)}
          defaultEnd={toDatetimeLocalBogota(endDefault)}
        />
      )}
    </main>
  );
}

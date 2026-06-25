import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { formatDateLong, formatTime } from "@/lib/datetime";
import { formatCents } from "@/lib/money";

const STATUS_LABELS: Record<string, string> = {
  requested: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

const STATUS_STYLES: Record<string, string> = {
  requested:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
  approved:
    "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200",
  rejected:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200",
  cancelled:
    "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

export const dynamic = "force-dynamic";

export default async function ExternalStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    notFound();
  }

  const admin = createServiceClient();
  const { data } = await admin
    .from("bookings")
    .select(
      "id, starts_at, ends_at, status, client_name, client_email, total_cents, spaces:space_id(name)"
    )
    .eq("client_token", token)
    .eq("is_external", true)
    .maybeSingle();

  if (!data) notFound();

  return (
    <main className="min-h-dvh px-4 py-6 max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Tu reserva</h1>

      <section
        className={`rounded-md border px-4 py-3 space-y-1 ${
          STATUS_STYLES[data.status] ?? STATUS_STYLES.cancelled
        }`}
      >
        <p className="text-xs uppercase tracking-wide">
          {STATUS_LABELS[data.status] ?? data.status}
        </p>
        <p className="font-semibold capitalize">
          {formatDateLong(data.starts_at)}
        </p>
        <p className="text-sm tabular-nums">
          {formatTime(data.starts_at)} – {formatTime(data.ends_at)}
          <span className="opacity-60"> · </span>
          <span className="font-medium">{data.spaces?.name ?? "—"}</span>
        </p>
      </section>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm rounded-md border border-gray-200 dark:border-gray-800 px-4 py-3">
        <dt className="text-gray-500">A nombre de</dt>
        <dd>{data.client_name}</dd>
        <dt className="text-gray-500">Email</dt>
        <dd>{data.client_email}</dd>
        <dt className="text-gray-500">Total</dt>
        <dd className="font-medium">{formatCents(data.total_cents ?? 0)}</dd>
      </dl>

      {data.status === "requested" && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Estamos verificando tu pago. Te avisamos por email apenas un pastor
          confirme la aprobación.
        </p>
      )}
      {data.status === "approved" && (
        <p className="text-sm text-green-700 dark:text-green-300">
          ¡Listo! Tu reserva está confirmada. Te esperamos.
        </p>
      )}
      {data.status === "rejected" && (
        <p className="text-sm text-red-700 dark:text-red-300">
          Tu reserva fue rechazada. Si crees que es un error, contáctanos.
        </p>
      )}

      <Link
        href="/alquilar"
        className="inline-block text-sm underline text-gray-600 dark:text-gray-400"
      >
        Hacer otra reserva
      </Link>
    </main>
  );
}

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
  requested: "border-[color:#f3ecdc] bg-[#f3ecdc]/60",
  approved: "border-[color:var(--color-sage-200)] bg-sage-100",
  rejected: "border-[color:#f2e3dd] bg-[#f2e3dd]/60",
  cancelled: "border-line bg-bg-muted",
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
      <div>
        <p className="eyebrow">Mi reserva</p>
        <h1 className="font-serif text-3xl mt-1 tracking-[-0.02em]">
          Estado
        </h1>
      </div>

      <section
        className={`rounded-[22px] border px-5 py-4 space-y-1 ${
          STATUS_STYLES[data.status] ?? STATUS_STYLES.cancelled
        }`}
      >
        <p className="eyebrow">
          {STATUS_LABELS[data.status] ?? data.status}
        </p>
        <p className="font-serif text-xl capitalize">
          {formatDateLong(data.starts_at)}
        </p>
        <p className="text-sm tabular-nums">
          {formatTime(data.starts_at)} – {formatTime(data.ends_at)}
          <span className="opacity-60"> · </span>
          <span className="font-medium">{data.spaces?.name ?? "—"}</span>
        </p>
      </section>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm card">
        <dt className="text-fg2">A nombre de</dt>
        <dd>{data.client_name}</dd>
        <dt className="text-fg2">Email</dt>
        <dd>{data.client_email}</dd>
        <dt className="text-fg2">Total</dt>
        <dd className="font-medium">{formatCents(data.total_cents ?? 0)}</dd>
      </dl>

      {data.status === "requested" && (
        <p className="text-sm text-fg2">
          Estamos verificando tu pago. Te avisamos por email apenas confirmemos
          la aprobación.
        </p>
      )}
      {data.status === "approved" && (
        <p className="text-sm" style={{ color: "var(--color-positive)" }}>
          ¡Listo! Tu reserva está confirmada. Te esperamos.
        </p>
      )}
      {data.status === "rejected" && (
        <p className="text-sm" style={{ color: "var(--color-critical)" }}>
          Tu reserva fue rechazada. Si crees que es un error, contáctanos.
        </p>
      )}

      <Link
        href="/alquilar"
        className="inline-block text-sm underline text-fg2"
      >
        Hacer otra reserva
      </Link>
    </main>
  );
}

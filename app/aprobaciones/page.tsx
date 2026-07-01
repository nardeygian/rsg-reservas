import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import {
  formatDateLong,
  formatTime,
  toDateParam,
} from "@/lib/datetime";
import { formatCents } from "@/lib/money";
import {
  approveBookingAction,
  rejectBookingAction,
} from "./actions";

const STAFF_ROLES = [
  "pastor_sede",
  "admin_casa",
  "super_admin",
  "studio_admin",
];

const USE_TYPE_LABELS: Record<string, string> = {
  reunion_departamento: "Reunión de departamento",
  reunion_ministerio: "Reunión de ministerio",
  consejeria: "Consejería",
  discipulado: "Reunión de discipulado",
  evento: "Evento",
  externo: "Externo",
  studio_negocio: "Studio (negocio)",
  otro: "Otro",
};

const REQUESTED_ROLE_LABELS: Record<string, string> = {
  lider_departamento: "Líder de departamento",
  mentor: "Líder de Discipulado",
  pastor_ministerio: "Pastor de ministerio",
  pastor_sede: "Pastor de sede",
};

type PendingBooking = {
  id: string;
  starts_at: string;
  ends_at: string;
  use_type: string;
  title: string | null;
  expected_attendance: number | null;
  created_at: string;
  is_external: boolean;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  total_cents: number | null;
  payment_receipt_url: string | null;
  payment_status: string | null;
  spaces: { name: string } | null;
  creator: {
    full_name: string;
    requested_role: string | null;
  } | null;
  ministry: { name: string } | null;
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (!session.profile || !STAFF_ROLES.includes(session.profile.role)) {
    redirect("/?error=Sin%20permiso");
  }

  const supabase = await createClient();
  const { data: pending, error: queryError } = await supabase
    .from("bookings_staff")
    .select(
      `id, starts_at, ends_at, use_type, title, expected_attendance, created_at,
       is_external, client_name, client_email, client_phone, total_cents,
       payment_receipt_url, payment_status,
       spaces:space_id(name),
       creator:created_by(full_name, requested_role),
       ministry:ministry_id(name)`
    )
    .eq("status", "requested")
    .order("starts_at", { ascending: true })
    .returns<PendingBooking[]>();

  // Genera signed URLs para reservas externas con comprobante en paralelo —
  // antes era un loop secuencial que multiplicaba la latencia por N.
  const externalsWithReceipts = (pending ?? []).filter(
    (b) => b.is_external && b.payment_receipt_url
  );
  const signedResults = await Promise.all(
    externalsWithReceipts.map((b) =>
      supabase.storage
        .from("payment-receipts")
        .createSignedUrl(b.payment_receipt_url!, 60 * 60)
        .then((r) => [b.id, r.data?.signedUrl ?? null] as const)
    )
  );
  const receiptUrls = new Map<string, string>(
    signedResults
      .filter((r): r is [string, string] => r[1] !== null)
      .map(([id, url]) => [id, url])
  );

  return (
    <main className="min-h-dvh px-4 py-4 max-w-2xl mx-auto space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="eyebrow">Por revisar</p>
          <h1 className="font-serif text-2xl mt-1 tracking-[-0.02em]">
            Aprobaciones
          </h1>
        </div>
        <Link href="/" className="text-sm underline text-fg2">
          Inicio
        </Link>
      </header>

      {ok && (
        <p
          role="status"
          className="text-sm rounded-[14px] px-4 py-3 border border-[color:var(--color-sage-200)] bg-sage-100"
        >
          {ok}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-sm rounded-[14px] px-4 py-3"
          style={{ background: "#f2e3dd", color: "var(--color-critical)" }}
        >
          {error}
        </p>
      )}

      {queryError ? (
        <p className="text-sm" style={{ color: "var(--color-critical)" }}>
          No se pudo cargar la lista: {queryError.message}
        </p>
      ) : (pending ?? []).length === 0 ? (
        <p className="text-sm text-fg3 py-8 text-center">
          No hay reservas pendientes.
        </p>
      ) : (
        <ul className="space-y-3">
          {(pending ?? []).map((b) => (
            <li
              key={b.id}
              className={`rounded-[22px] border p-5 space-y-3 ${
                b.is_external
                  ? "border-[color:var(--color-blue-400)] bg-blue-200/30"
                  : "border-[color:#f3ecdc] bg-[#f3ecdc]/30"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold capitalize">
                  {formatDateLong(b.starts_at)}
                </p>
                {b.is_external && (
                  <span className="badge badge-external">Alquiler externo</span>
                )}
              </div>

              <p className="text-sm tabular-nums">
                {formatTime(b.starts_at)} – {formatTime(b.ends_at)}
                <span className="text-gray-500"> · </span>
                <span className="font-medium">{b.spaces?.name ?? "—"}</span>
              </p>

              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {b.is_external ? (
                  <>
                    <dt className="text-gray-500">Cliente</dt>
                    <dd>
                      {b.client_name ?? "—"}
                      {b.client_email && (
                        <span className="text-gray-500"> · {b.client_email}</span>
                      )}
                    </dd>
                    {b.client_phone && (
                      <>
                        <dt className="text-gray-500">Teléfono</dt>
                        <dd>{b.client_phone}</dd>
                      </>
                    )}
                    <dt className="text-gray-500">Total</dt>
                    <dd className="font-semibold">
                      {formatCents(b.total_cents ?? 0)}
                    </dd>
                    <dt className="text-gray-500">Pago</dt>
                    <dd>
                      {receiptUrls.has(b.id) ? (
                        <a
                          href={receiptUrls.get(b.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          Ver comprobante
                        </a>
                      ) : (
                        <span className="text-gray-500">Sin comprobante</span>
                      )}
                    </dd>
                  </>
                ) : (
                  <>
                    <dt className="text-gray-500">Solicita</dt>
                    <dd>
                      {b.creator?.full_name ?? "—"}
                      {b.creator?.requested_role && (
                        <span className="text-gray-500">
                          {" "}·{" "}
                          {REQUESTED_ROLE_LABELS[b.creator.requested_role] ??
                            b.creator.requested_role}
                        </span>
                      )}
                    </dd>
                    <dt className="text-gray-500">Tipo</dt>
                    <dd>
                      {USE_TYPE_LABELS[b.use_type] ?? b.use_type}
                      {b.ministry && (
                        <span className="text-gray-500">
                          {" "}· {b.ministry.name}
                        </span>
                      )}
                    </dd>
                  </>
                )}

                {b.title && (
                  <>
                    <dt className="text-gray-500">
                      {b.is_external ? "Evento" : "Título"}
                    </dt>
                    <dd>{b.title}</dd>
                  </>
                )}

                {b.expected_attendance != null && (
                  <>
                    <dt className="text-gray-500">Asistencia</dt>
                    <dd>{b.expected_attendance}</dd>
                  </>
                )}
              </dl>

              <form className="space-y-2">
                <input type="hidden" name="id" value={b.id} />
                <label className="block">
                  <span className="eyebrow">
                    Notas internas (opcional)
                  </span>
                  <textarea
                    name="internal_notes"
                    rows={2}
                    placeholder="Ej. confirmado por WhatsApp, requiere micrófono extra, etc."
                    className="input mt-2"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    formAction={approveBookingAction}
                    className="rounded-md bg-green-600 text-white px-3 py-1.5 text-sm font-medium"
                  >
                    ✓ Aprobar
                  </button>
                  <button
                    type="submit"
                    formAction={rejectBookingAction}
                    className="rounded-md border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-1.5 text-sm font-medium"
                  >
                    ✗ Rechazar
                  </button>
                  <Link
                    href={`/reservas/${b.id}`}
                    className="ml-auto text-xs underline text-gray-600 dark:text-gray-400"
                  >
                    Detalle
                  </Link>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

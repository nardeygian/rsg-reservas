import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  formatDateLong,
  formatTime,
  toDateParam,
} from "@/lib/datetime";
import {
  approveBookingAction,
  cancelBookingAction,
  cancelSeriesAction,
  rejectBookingAction,
  removePaymentReceiptAction,
  uploadPaymentReceiptAction,
} from "./actions";

const STAFF_ROLES = ["pastor_sede", "admin_casa", "super_admin"];

const USE_TYPE_LABELS: Record<string, string> = {
  reunion_departamento: "Reunión de departamento",
  reunion_ministerio: "Reunión de ministerio",
  consejeria: "Consejería",
  discipulado: "Discipulado",
  evento: "Evento",
  externo: "Externo",
  studio_negocio: "Studio (negocio)",
  otro: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  requested: "Por aprobar",
  approved: "Aprobada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

const STATUS_STYLES: Record<string, string> = {
  approved:
    "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200",
  requested:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  rejected:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
  cancelled:
    "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

const PAYMENT_LABELS: Record<string, string> = {
  not_applicable: "No aplica",
  pending: "Pendiente",
  paid: "Pagado",
};

type StaffBooking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  use_type: string;
  visibility: string;
  title: string | null;
  expected_attendance: number | null;
  shared_occupancy_allowed: boolean;
  montaje_lock: boolean;
  payment_status: string;
  payment_receipt_url: string | null;
  internal_notes: string | null;
  requirements: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  is_external: boolean;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  total_cents: number | null;
  spaces: { name: string } | null;
  organizations: { name: string } | null;
  creator: { full_name: string; requested_role: string | null } | null;
  ministry: { name: string; type: string } | null;
  payment_actor: { full_name: string } | null;
};

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const { error, ok } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isStaff = !!profile && STAFF_ROLES.includes(profile.role);

  // Base: lo que todos pueden ver. bookings_calendar enmascara private_label.
  const { data: base } = await supabase
    .from("bookings_calendar")
    .select(
      "id, space_name, starts_at, ends_at, status, display_owner, use_type, has_montaje_lock, created_by, title, parent_booking_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (!base) {
    notFound();
  }

  // Staff: completa con detalle interno desde bookings_staff (incluye joins).
  let detail: StaffBooking | null = null;
  let receiptSignedUrl: string | null = null;
  if (isStaff) {
    const { data } = await supabase
      .from("bookings_staff")
      .select(
        `id, starts_at, ends_at, status, use_type, visibility, title,
         expected_attendance, shared_occupancy_allowed, montaje_lock,
         payment_status, payment_receipt_url, internal_notes, requirements,
         created_by, created_at,
         is_external, client_name, client_email, client_phone, total_cents,
         spaces:space_id(name),
         organizations:owner_org_id(name),
         creator:created_by(full_name, requested_role),
         ministry:ministry_id(name, type),
         payment_actor:payment_marked_by(full_name)`
      )
      .eq("id", id)
      .maybeSingle()
      .returns<StaffBooking>();
    detail = data;

    if (detail?.payment_receipt_url) {
      const { data: signed } = await supabase.storage
        .from("payment-receipts")
        .createSignedUrl(detail.payment_receipt_url, 60 * 60);
      receiptSignedUrl = signed?.signedUrl ?? null;
    }
  }

  const isCreator = base.created_by === user.id;
  const isPending = base.status === "requested";
  const isCancellable =
    base.status === "requested" || base.status === "approved";
  const canApprove = isStaff && isPending;
  const canCancel = (isStaff || isCreator) && isCancellable;
  const isPartOfSeries = !!base.parent_booking_id;
  const canCancelSeries = isPartOfSeries && (isStaff || isCreator);

  // Items pedidos. RLS deja leer a staff o al creador.
  const { data: bookedItems } = await supabase
    .from("booking_items")
    .select("quantity, item:rentable_items(name)")
    .eq("booking_id", id)
    .returns<{ quantity: number; item: { name: string } | null }[]>();

  const requirementsList =
    detail?.requirements && typeof detail.requirements === "object"
      ? Object.entries(detail.requirements).filter(([, v]) => v != null && v !== "")
      : [];

  return (
    <main className="min-h-dvh px-4 py-4 max-w-2xl mx-auto space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Detalle de reserva</h1>
        <Link
          href={
            base.starts_at
              ? `/calendario?view=dia&date=${toDateParam(new Date(base.starts_at))}`
              : "/calendario"
          }
          className="text-sm underline text-gray-600 dark:text-gray-400"
        >
          ← Calendario
        </Link>
      </header>

      {ok && (
        <p
          role="status"
          className="text-sm rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40 px-3 py-2"
        >
          {ok}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-sm rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 px-3 py-2"
        >
          {error}
        </p>
      )}

      <section
        className={`rounded-md border px-4 py-3 space-y-1 ${
          STATUS_STYLES[base.status ?? ""] ?? STATUS_STYLES.cancelled
        }`}
      >
        <p className="text-xs uppercase tracking-wide">
          {STATUS_LABELS[base.status ?? ""] ?? base.status}
          {isPartOfSeries && (
            <span className="ml-2">· 🔁 parte de una serie semanal</span>
          )}
        </p>
        <p className="font-semibold capitalize text-base">
          {base.starts_at ? formatDateLong(base.starts_at) : ""}
        </p>
        <p className="text-sm tabular-nums">
          {base.starts_at && base.ends_at
            ? `${formatTime(base.starts_at)} – ${formatTime(base.ends_at)}`
            : ""}
          <span className="opacity-60"> · </span>
          <span className="font-medium">{base.space_name}</span>
        </p>
      </section>

      <section className="rounded-md border border-gray-200 dark:border-gray-800 p-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-gray-500">Reserva</dt>
          <dd className="font-medium">{base.display_owner ?? "—"}</dd>

          {base.use_type && (
            <>
              <dt className="text-gray-500">Tipo</dt>
              <dd>{USE_TYPE_LABELS[base.use_type] ?? base.use_type}</dd>
            </>
          )}

          {base.title && (
            <>
              <dt className="text-gray-500">Título</dt>
              <dd>{base.title}</dd>
            </>
          )}

          {base.has_montaje_lock && (
            <>
              <dt className="text-gray-500">Montaje</dt>
              <dd>🔒 Bloqueado</dd>
            </>
          )}

          {(bookedItems ?? []).length > 0 && (
            <>
              <dt className="text-gray-500">Items</dt>
              <dd>
                <ul className="list-disc pl-4">
                  {(bookedItems ?? []).map((bi, idx) => (
                    <li key={idx}>
                      {bi.quantity} × {bi.item?.name ?? "—"}
                    </li>
                  ))}
                </ul>
              </dd>
            </>
          )}
        </dl>
      </section>

      {isStaff && detail && (
        <section className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 p-4">
          <h2 className="text-xs uppercase tracking-wide text-blue-900 dark:text-blue-200 mb-2">
            {detail.is_external
              ? "Detalle del cliente externo"
              : "Detalle interno (staff)"}
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            {detail.is_external ? (
              <>
                <dt className="text-gray-500">Cliente</dt>
                <dd className="font-medium">{detail.client_name ?? "—"}</dd>

                {detail.client_email && (
                  <>
                    <dt className="text-gray-500">Email</dt>
                    <dd>
                      <a
                        href={`mailto:${detail.client_email}`}
                        className="underline"
                      >
                        {detail.client_email}
                      </a>
                    </dd>
                  </>
                )}

                {detail.client_phone && (
                  <>
                    <dt className="text-gray-500">Teléfono</dt>
                    <dd>
                      <a
                        href={`tel:${detail.client_phone}`}
                        className="underline"
                      >
                        {detail.client_phone}
                      </a>
                    </dd>
                  </>
                )}

                <dt className="text-gray-500">Total cobrado</dt>
                <dd className="font-semibold">
                  {detail.total_cents != null
                    ? `$ ${(detail.total_cents / 100).toLocaleString("es-CO")}`
                    : "—"}
                </dd>
              </>
            ) : (
              <>
                <dt className="text-gray-500">Solicita</dt>
                <dd>{detail.creator?.full_name ?? "—"}</dd>

                <dt className="text-gray-500">Organización</dt>
                <dd>{detail.organizations?.name ?? "—"}</dd>

                {detail.ministry && (
                  <>
                    <dt className="text-gray-500">
                      {detail.ministry.type === "departamento"
                        ? "Departamento"
                        : "Ministerio"}
                    </dt>
                    <dd>{detail.ministry.name}</dd>
                  </>
                )}
              </>
            )}

            {detail.expected_attendance != null && (
              <>
                <dt className="text-gray-500">Asistencia esperada</dt>
                <dd>{detail.expected_attendance}</dd>
              </>
            )}

            <dt className="text-gray-500">Pago</dt>
            <dd>
              {PAYMENT_LABELS[detail.payment_status] ?? detail.payment_status}
              {detail.payment_actor && (
                <span className="text-gray-500">
                  {" "}
                  · {detail.payment_actor.full_name}
                </span>
              )}
              {receiptSignedUrl && (
                <>
                  {" · "}
                  <a
                    href={receiptSignedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Ver comprobante
                  </a>
                </>
              )}
            </dd>

            <dt className="text-gray-500">Compartido</dt>
            <dd>
              {detail.shared_occupancy_allowed
                ? "Permite ocupación compartida"
                : "Exclusivo"}
            </dd>

            <dt className="text-gray-500">Visibilidad</dt>
            <dd>
              {detail.visibility === "private_label"
                ? "Privada (Estudio business)"
                : detail.visibility === "limited"
                  ? "Limitada"
                  : "Completa"}
            </dd>

            {requirementsList.length > 0 && (
              <>
                <dt className="text-gray-500">Requerimientos</dt>
                <dd>
                  <ul className="list-disc pl-4">
                    {requirementsList.map(([k, v]) => (
                      <li key={k}>
                        <span className="text-gray-500">{k}:</span>{" "}
                        {String(v)}
                      </li>
                    ))}
                  </ul>
                </dd>
              </>
            )}

            {detail.internal_notes && (
              <>
                <dt className="text-gray-500">Notas internas</dt>
                <dd className="whitespace-pre-wrap">{detail.internal_notes}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {(canApprove || canCancel) && (
        <section className="flex flex-wrap items-center gap-2">
          {canApprove && (
            <>
              <form action={approveBookingAction}>
                <input type="hidden" name="id" value={base.id ?? ""} />
                <button
                  type="submit"
                  className="rounded-md bg-green-600 text-white px-4 py-2 text-sm font-medium"
                >
                  ✓ Aprobar
                </button>
              </form>
              <form action={rejectBookingAction}>
                <input type="hidden" name="id" value={base.id ?? ""} />
                <button
                  type="submit"
                  className="rounded-md border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 text-sm font-medium"
                >
                  ✗ Rechazar
                </button>
              </form>
            </>
          )}
          {canCancel && (
            <form action={cancelBookingAction}>
              <input type="hidden" name="id" value={base.id ?? ""} />
              <button
                type="submit"
                className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm"
              >
                Cancelar solo esta
              </button>
            </form>
          )}
          {canCancelSeries && (
            <form action={cancelSeriesAction}>
              <input type="hidden" name="id" value={base.id ?? ""} />
              <button
                type="submit"
                className="rounded-md border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 text-sm"
              >
                Cancelar toda la serie
              </button>
            </form>
          )}
        </section>
      )}

      {isStaff && detail && base.id && (
        <section className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
          <h2 className="text-base font-semibold">Comprobante de pago</h2>
          {detail.payment_receipt_url ? (
            <div className="space-y-2">
              <p className="text-sm">
                Archivo cargado.
                {receiptSignedUrl && (
                  <>
                    {" "}
                    <a
                      href={receiptSignedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Abrir
                    </a>
                  </>
                )}
              </p>
              <form action={removePaymentReceiptAction}>
                <input type="hidden" name="id" value={base.id} />
                <button
                  type="submit"
                  className="text-sm underline text-red-700 dark:text-red-300"
                >
                  Eliminar comprobante
                </button>
              </form>
            </div>
          ) : (
            <form
              action={uploadPaymentReceiptAction}
              encType="multipart/form-data"
              className="space-y-2"
            >
              <input type="hidden" name="id" value={base.id} />
              <input
                type="file"
                name="receipt"
                accept="image/png,image/jpeg,application/pdf"
                required
                className="block w-full text-sm"
              />
              <p className="text-xs text-gray-500">
                PDF, PNG o JPG. Máximo 5 MB. Al subirlo la reserva queda
                marcada como pagada.
              </p>
              <button
                type="submit"
                className="rounded-md bg-black text-white px-4 py-2 text-sm font-medium dark:bg-white dark:text-black"
              >
                Subir comprobante
              </button>
            </form>
          )}
        </section>
      )}

      {(isStaff || isCreator) && base.id && (
        <section className="border-t border-gray-200 dark:border-gray-800 pt-4">
          <a
            href={`/api/bookings/${base.id}/ics`}
            download
            className="inline-flex items-center gap-2 text-sm underline text-gray-700 dark:text-gray-300"
          >
            📅 Agregar a mi calendario (.ics)
          </a>
          <p className="text-xs text-gray-500 mt-1">
            Importa este evento como una foto puntual. Si la reserva cambia
            después, tu calendario no se actualiza solo.
          </p>
        </section>
      )}
    </main>
  );
}

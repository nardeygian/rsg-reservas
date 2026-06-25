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
  approved: "border-[color:var(--color-sage-200)] bg-sage-100/50",
  requested: "border-[color:#f3ecdc] bg-[#f3ecdc]/40",
  rejected: "border-[color:#f2e3dd] bg-[#f2e3dd]/40",
  cancelled: "border-line bg-bg-muted",
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
        <div>
          <p className="eyebrow">Detalle</p>
          <h1 className="font-serif text-2xl mt-1 tracking-[-0.02em]">
            Reserva
          </h1>
        </div>
        <Link
          href={
            base.starts_at
              ? `/calendario?view=dia&date=${toDateParam(new Date(base.starts_at))}`
              : "/calendario"
          }
          className="text-sm underline text-fg2"
        >
          ← Calendario
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

      <section className="card">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-fg2">Reserva</dt>
          <dd className="font-medium">{base.display_owner ?? "—"}</dd>

          {base.use_type && (
            <>
              <dt className="text-fg2">Tipo</dt>
              <dd>{USE_TYPE_LABELS[base.use_type] ?? base.use_type}</dd>
            </>
          )}

          {base.title && (
            <>
              <dt className="text-fg2">Título</dt>
              <dd>{base.title}</dd>
            </>
          )}

          {base.has_montaje_lock && (
            <>
              <dt className="text-fg2">Montaje</dt>
              <dd>🔒 Bloqueado</dd>
            </>
          )}

          {(bookedItems ?? []).length > 0 && (
            <>
              <dt className="text-fg2">Items</dt>
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
        <section
          className="rounded-[22px] p-6 border"
          style={{
            background: "var(--color-blue-200)",
            borderColor: "var(--color-blue-400)",
            color: "var(--color-forest-500)",
          }}
        >
          <h2 className="eyebrow mb-2"
            style={{ color: "var(--color-forest-500)" }}
          >
            {detail.is_external
              ? "Detalle del cliente externo"
              : "Detalle interno (staff)"}
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            {detail.is_external ? (
              <>
                <dt className="text-fg2">Cliente</dt>
                <dd className="font-medium">{detail.client_name ?? "—"}</dd>

                {detail.client_email && (
                  <>
                    <dt className="text-fg2">Email</dt>
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
                    <dt className="text-fg2">Teléfono</dt>
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

                <dt className="text-fg2">Total cobrado</dt>
                <dd className="font-semibold">
                  {detail.total_cents != null
                    ? `$ ${(detail.total_cents / 100).toLocaleString("es-CO")}`
                    : "—"}
                </dd>
              </>
            ) : (
              <>
                <dt className="text-fg2">Solicita</dt>
                <dd>{detail.creator?.full_name ?? "—"}</dd>

                <dt className="text-fg2">Organización</dt>
                <dd>{detail.organizations?.name ?? "—"}</dd>

                {detail.ministry && (
                  <>
                    <dt className="text-fg2">
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
                <dt className="text-fg2">Asistencia esperada</dt>
                <dd>{detail.expected_attendance}</dd>
              </>
            )}

            <dt className="text-fg2">Pago</dt>
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

            <dt className="text-fg2">Compartido</dt>
            <dd>
              {detail.shared_occupancy_allowed
                ? "Permite ocupación compartida"
                : "Exclusivo"}
            </dd>

            <dt className="text-fg2">Visibilidad</dt>
            <dd>
              {detail.visibility === "private_label"
                ? "Privada (Estudio business)"
                : detail.visibility === "limited"
                  ? "Limitada"
                  : "Completa"}
            </dd>

            {requirementsList.length > 0 && (
              <>
                <dt className="text-fg2">Requerimientos</dt>
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
                <dt className="text-fg2">Notas internas</dt>
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
                  className="rounded-full px-5 h-11 text-sm font-semibold inline-flex items-center gap-2 active:scale-[0.97] transition"
                  style={{
                    background: "var(--color-positive)",
                    color: "var(--color-sand-100)",
                  }}
                >
                  ✓ Aprobar
                </button>
              </form>
              <form action={rejectBookingAction}>
                <input type="hidden" name="id" value={base.id ?? ""} />
                <button
                  type="submit"
                  className="rounded-full px-5 h-11 text-sm font-semibold inline-flex items-center gap-2 border active:scale-[0.97] transition"
                  style={{
                    borderColor: "var(--color-critical)",
                    color: "var(--color-critical)",
                  }}
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
                className="btn-secondary !h-11"
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
                className="rounded-full px-5 h-11 text-sm font-semibold inline-flex items-center gap-2 border active:scale-[0.97] transition"
              style={{
                borderColor: "var(--color-critical)",
                color: "var(--color-critical)",
              }}
              >
                Cancelar toda la serie
              </button>
            </form>
          )}
        </section>
      )}

      {isStaff && detail && base.id && (
        <section className="border-t border-line pt-4 space-y-3">
          <h2 className="eyebrow">Comprobante de pago</h2>
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
                  className="text-sm underline"
                  style={{ color: "var(--color-critical)" }}
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
              <p className="text-xs text-fg3">
                PDF, PNG o JPG. Máximo 5 MB. Al subirlo la reserva queda
                marcada como pagada.
              </p>
              <button
                type="submit"
                className="btn-primary"
              >
                Subir comprobante
              </button>
            </form>
          )}
        </section>
      )}

      {(isStaff || isCreator) && base.id && (
        <section className="border-t border-line pt-4">
          <a
            href={`/api/bookings/${base.id}/ics`}
            download
            className="inline-flex items-center gap-2 text-sm underline text-fg2"
          >
            📅 Agregar a mi calendario (.ics)
          </a>
          <p className="text-xs text-fg3 mt-1">
            Importa este evento como una foto puntual. Si la reserva cambia
            después, tu calendario no se actualiza solo.
          </p>
        </section>
      )}
    </main>
  );
}

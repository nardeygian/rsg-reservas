import { Icon } from "@/app/_components/ui/Icon";
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
import { ReceiptUpload } from "./_components/ReceiptUpload";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-sm flex-none" style={{ color: "var(--color-muted)" }}>
        {label}
      </span>
      <span className="text-sm font-medium text-right" style={{ color: "var(--color-ink)" }}>
        {value}
      </span>
    </div>
  );
}

const STAFF_ROLES = ["pastor_sede", "admin_casa", "super_admin"];
const ESTUDIO_SPACE_NAME = "Estudio";

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

const STATUS_LABELS: Record<string, string> = {
  requested: "Por aprobar",
  approved: "Aprobada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

const STATUS_STYLES: Record<string, string> = {
  approved: "border-[color:var(--color-accent-soft)] bg-[color:var(--color-accent-soft)]/30",
  requested: "border-[color:var(--color-gold-soft)] bg-[color:var(--color-gold-soft)]/50",
  rejected: "border-[color:var(--color-down-soft)] bg-[color:var(--color-down-soft)]/50",
  cancelled: "border-[color:var(--color-line)] bg-[color:var(--color-surface-2)]",
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

  const isFullStaff = !!profile && STAFF_ROLES.includes(profile.role);
  // El studio_admin tiene acceso de staff únicamente para reservas del Estudio.
  const isStudioAdminOnEstudio =
    profile?.role === "studio_admin" && base.space_name === ESTUDIO_SPACE_NAME;
  const isStaff = isFullStaff || isStudioAdminOnEstudio;

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

  const heroStyle =
    base.status === "approved"
      ? { borderColor: "var(--color-accent)", background: "var(--color-accent-soft)" }
      : base.status === "requested"
      ? { borderColor: "var(--color-gold)", background: "var(--color-gold-soft)" }
      : base.status === "rejected"
      ? { borderColor: "var(--color-down)", background: "var(--color-down-soft)" }
      : { borderColor: "var(--color-line)", background: "var(--color-surface-2)" };

  const statusBadgeStyle =
    base.status === "approved"
      ? { background: "var(--color-accent)", color: "#fff" }
      : base.status === "requested"
      ? { background: "var(--color-gold)", color: "#fff" }
      : base.status === "rejected"
      ? { background: "var(--color-down)", color: "#fff" }
      : { background: "var(--color-surface)", color: "var(--color-muted)" };

  const dateStr = base.starts_at ? formatDateLong(base.starts_at) : "";
  const dateCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  return (
    <main
      className="min-h-dvh flex flex-col gap-3 px-4 pt-5 pb-8 max-w-xl mx-auto"
     
    >
      {/* Header */}
      <header className="flex items-center justify-between mb-1">
        <div>
          <span className="eyebrow">Reservas</span>
          <h1
            className="text-[22px] font-bold leading-tight mt-0.5"
            style={{ fontFamily: "var(--font-display)", color: "var(--color-ink)" }}
          >
            Detalle
          </h1>
        </div>
        <Link
          href={
            base.starts_at
              ? `/reservas?date=${toDateParam(new Date(base.starts_at))}`
              : "/reservas"
          }
          className="flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-[var(--radius-control)]"
          style={{
            background: "var(--color-surface)",
            color: "var(--color-muted)",
            border: "1px solid var(--color-line)",
          }}
        >
          <span className="inline-flex items-center gap-1.5"><Icon name="chevron-left" size={15} />Reservas</span>
        </Link>
      </header>

      {/* Toasts */}
      {ok && (
        <p
          role="status"
          className="text-sm rounded-[var(--radius-control)] px-4 py-3 font-medium"
          style={{ background: "var(--color-up-soft)", color: "var(--color-up)" }}
        >
          {ok}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-sm rounded-[var(--radius-control)] px-4 py-3 font-medium"
          style={{ background: "var(--color-down-soft)", color: "var(--color-down)" }}
        >
          {error}
        </p>
      )}

      {/* Status hero */}
      <section className="rounded-[var(--radius-card)] border-2 overflow-hidden" style={heroStyle}>
        <div className="px-5 pt-5 pb-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
              style={statusBadgeStyle}
            >
              {STATUS_LABELS[base.status ?? ""] ?? base.status}
            </span>
            {isPartOfSeries && (
              <span className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                <span className="inline-flex items-center gap-1.5"><Icon name="repeat" size={13} />serie semanal</span>
              </span>
            )}
          </div>
          <div>
            <p
              className="text-[20px] font-bold leading-tight"
              style={{ fontFamily: "var(--font-display)", color: "var(--color-ink)" }}
            >
              {dateCapitalized}
            </p>
            <p className="mt-1 text-sm font-medium" style={{ color: "var(--color-muted)" }}>
              {base.starts_at && base.ends_at
                ? `${formatTime(base.starts_at)} – ${formatTime(base.ends_at)}`
                : ""}
              {" · "}
              <span style={{ color: "var(--color-ink)" }}>{base.space_name}</span>
            </p>
          </div>
        </div>
      </section>

      {/* Basic info */}
      <section
        className="rounded-[var(--radius-card)] border overflow-hidden divide-y"
        style={{
          borderColor: "var(--color-line)",
          background: "var(--color-surface)",
          // @ts-ignore
          "--tw-divide-opacity": 1,
        }}
      >
        <InfoRow label="Quién reserva" value={base.display_owner ?? "—"} />
        {base.use_type && (
          <InfoRow label="Tipo" value={USE_TYPE_LABELS[base.use_type] ?? base.use_type} />
        )}
        {base.title && <InfoRow label="Título" value={base.title} />}
        {base.has_montaje_lock && <InfoRow label="Montaje" value={<span className="inline-flex items-center gap-1.5"><Icon name="lock" size={13} />Bloqueado</span>} />}
        {(bookedItems ?? []).length > 0 && (
          <InfoRow
            label="Items"
            value={
              <span className="flex flex-col gap-0.5 items-end">
                {(bookedItems ?? []).map((bi, idx) => (
                  <span key={idx}>
                    {bi.quantity} × {bi.item?.name ?? "—"}
                  </span>
                ))}
              </span>
            }
          />
        )}
      </section>

      {/* Staff detail */}
      {isStaff && detail && (
        <section
          className="rounded-[var(--radius-card)] border overflow-hidden"
          style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-line)" }}>
            <span className="eyebrow">
              {detail.is_external ? "Cliente externo" : "Detalle staff"}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {detail.is_external ? (
              <>
                <InfoRow label="Cliente" value={detail.client_name ?? "—"} />
                {detail.client_email && (
                  <InfoRow
                    label="Email"
                    value={
                      <a href={`mailto:${detail.client_email}`} className="underline">
                        {detail.client_email}
                      </a>
                    }
                  />
                )}
                {detail.client_phone && (
                  <InfoRow
                    label="Teléfono"
                    value={
                      <a href={`tel:${detail.client_phone}`} className="underline">
                        {detail.client_phone}
                      </a>
                    }
                  />
                )}
                <InfoRow
                  label="Total"
                  value={
                    detail.total_cents != null
                      ? `$ ${(detail.total_cents / 100).toLocaleString("es-CO")}`
                      : "—"
                  }
                />
              </>
            ) : (
              <>
                <InfoRow label="Solicita" value={detail.creator?.full_name ?? "—"} />
                <InfoRow label="Organización" value={detail.organizations?.name ?? "—"} />
                {detail.ministry && (
                  <InfoRow
                    label={detail.ministry.type === "departamento" ? "Departamento" : "Ministerio"}
                    value={detail.ministry.name}
                  />
                )}
              </>
            )}
            {detail.expected_attendance != null && (
              <InfoRow label="Asistencia esperada" value={String(detail.expected_attendance)} />
            )}
            <InfoRow
              label="Pago"
              value={
                <span className="flex items-center gap-2 flex-wrap justify-end">
                  <span>{PAYMENT_LABELS[detail.payment_status] ?? detail.payment_status}</span>
                  {detail.payment_actor && (
                    <span style={{ color: "var(--color-muted)" }}>
                      · {detail.payment_actor.full_name}
                    </span>
                  )}
                  {receiptSignedUrl && (
                    <a
                      href={receiptSignedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-xs"
                      style={{ color: "var(--color-accent)" }}
                    >
                      Ver comprobante
                    </a>
                  )}
                </span>
              }
            />
            <InfoRow
              label="Ocupación"
              value={detail.shared_occupancy_allowed ? "Compartida" : "Exclusiva"}
            />
            <InfoRow
              label="Visibilidad"
              value={
                detail.visibility === "private_label"
                  ? "Privada"
                  : detail.visibility === "limited"
                  ? "Limitada"
                  : "Completa"
              }
            />
            {requirementsList.length > 0 && (
              <InfoRow
                label="Requerimientos"
                value={
                  <span className="flex flex-col gap-0.5 items-end">
                    {requirementsList.map(([k, v]) => (
                      <span key={k} className="text-xs">
                        {k}: {String(v)}
                      </span>
                    ))}
                  </span>
                }
              />
            )}
            {detail.internal_notes && (
              <div className="px-4 py-3 flex flex-col gap-1">
                <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Notas internas
                </span>
                <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--color-ink)" }}>
                  {detail.internal_notes}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Actions */}
      {(canApprove || canCancel) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {canApprove && (
            <>
              <form action={approveBookingAction}>
                <input type="hidden" name="id" value={base.id ?? ""} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-[var(--radius-control)] px-5 h-11 text-sm font-semibold active:scale-[0.97] transition"
                  style={{ background: "var(--color-up-soft)", color: "var(--color-up)" }}
                >
                  <Icon name="check" size={17} />Aprobar
                </button>
              </form>
              <form action={rejectBookingAction}>
                <input type="hidden" name="id" value={base.id ?? ""} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-[var(--radius-control)] px-5 h-11 text-sm font-semibold border active:scale-[0.97] transition"
                  style={{ borderColor: "var(--color-down)", color: "var(--color-down)" }}
                >
                  <Icon name="close" size={17} />Rechazar
                </button>
              </form>
            </>
          )}
          {canCancel && (
            <form action={cancelBookingAction}>
              <input type="hidden" name="id" value={base.id ?? ""} />
              <button type="submit" className="btn-secondary !h-11">
                Cancelar solo esta
              </button>
            </form>
          )}
          {canCancelSeries && (
            <form action={cancelSeriesAction}>
              <input type="hidden" name="id" value={base.id ?? ""} />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-[var(--radius-control)] px-5 h-11 text-sm font-semibold border active:scale-[0.97] transition"
                style={{ borderColor: "var(--color-down)", color: "var(--color-down)" }}
              >
                Cancelar toda la serie
              </button>
            </form>
          )}
        </div>
      )}

      {/* Comprobante */}
      {isStaff && detail && base.id && (
        <section
          className="rounded-[var(--radius-card)] border p-4 flex flex-col gap-3"
          style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
        >
          <span className="eyebrow">Comprobante de pago</span>
          {detail.payment_receipt_url ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm" style={{ color: "var(--color-ink)" }}>
                Archivo cargado.{" "}
                {receiptSignedUrl && (
                  <a
                    href={receiptSignedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                    style={{ color: "var(--color-accent)" }}
                  >
                    Abrir
                  </a>
                )}
              </p>
              <form action={removePaymentReceiptAction}>
                <input type="hidden" name="id" value={base.id} />
                <button
                  type="submit"
                  className="text-sm underline"
                  style={{ color: "var(--color-down)" }}
                >
                  Eliminar comprobante
                </button>
              </form>
            </div>
          ) : (
            <ReceiptUpload bookingId={base.id} action={uploadPaymentReceiptAction} />
          )}
        </section>
      )}

      {/* Agregar al calendario */}
      {(isStaff || isCreator) && base.id && (
        <div
          className="rounded-[var(--radius-card)] border px-4 py-3 flex flex-col gap-1"
          style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
        >
          <a
            href={`/api/bookings/${base.id}/ics`}
            download
            className="text-sm font-medium"
            style={{ color: "var(--color-accent)" }}
          >
            <span className="inline-flex items-center gap-1.5"><Icon name="calendar-plus" size={16} />Agregar a mi calendario (.ics)</span>
          </a>
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            Importa este evento como una foto puntual. Si la reserva cambia, tu calendario no se actualiza solo.
          </p>
        </div>
      )}
    </main>
  );
}

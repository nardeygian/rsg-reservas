import { formatDateLong, formatTime } from "@/lib/datetime";
import { sendChannelMessage, sendDirectMessage } from "@/lib/slack";
import { createServiceClient } from "@/lib/supabase/service";

export type BookingEvent =
  | "created"
  | "approved"
  | "rejected"
  | "cancelled";

const EVENT_ICON: Record<BookingEvent, string> = {
  created: "🆕",
  approved: "✅",
  rejected: "❌",
  cancelled: "🚫",
};

const EVENT_LABEL: Record<BookingEvent, string> = {
  created: "Nueva reserva",
  approved: "Reserva aprobada",
  rejected: "Reserva rechazada",
  cancelled: "Reserva cancelada",
};

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

type BookingRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  use_type: string;
  title: string | null;
  visibility: string;
  created_by: string;
  spaces: { name: string } | null;
  creator: { full_name: string; slack_user_id: string | null } | null;
  ministry: { name: string } | null;
};

// Roles que reciben DM personal cuando llega una reserva por aprobar.
// admin_casa no está aquí a propósito: la aprobación la resuelven pastor
// de sede y super_admin. admin_casa se entera por el canal del staff.
const APPROVER_ROLES_FOR_DM = ["pastor_sede", "super_admin"];

function siteUrl(): string {
  return process.env.SITE_URL ?? "http://localhost:3010";
}

// Notifica un cambio de estado en una reserva. Best-effort: cualquier fallo se
// loggea y NO interrumpe la acción que disparó la notificación. Usa
// service_role internamente para que funcione independientemente del rol del
// usuario que disparó el evento (un leader no tiene SELECT directo en bookings).
export async function notifyBookingEvent(
  bookingId: string,
  event: BookingEvent,
  actorUserId?: string
): Promise<void> {
  try {
    const admin = createServiceClient();

    const { data, error } = await admin
      .from("bookings")
      .select(
        `id, starts_at, ends_at, status, use_type, title, visibility, created_by,
         spaces:space_id(name),
         creator:created_by(full_name, slack_user_id),
         ministry:ministry_id(name)`
      )
      .eq("id", bookingId)
      .maybeSingle<BookingRow>();

    if (error || !data) {
      console.error("[notify] no se pudo leer la reserva", bookingId, error);
      return;
    }

    let actorName: string | null = null;
    if (actorUserId) {
      const { data: actor } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", actorUserId)
        .maybeSingle();
      actorName = actor?.full_name ?? null;
    }

    const useTypeLabel = USE_TYPE_LABELS[data.use_type] ?? data.use_type;
    const space = data.spaces?.name ?? "—";
    const date = formatDateLong(data.starts_at);
    const time = `${formatTime(data.starts_at)} – ${formatTime(data.ends_at)}`;
    const owner =
      data.visibility === "private_label"
        ? "Reserva externa"
        : data.ministry?.name ?? "RSG";
    const link = `${siteUrl()}/reservas/${data.id}`;

    const channelText =
      `${EVENT_ICON[event]} *${EVENT_LABEL[event]}*\n` +
      `${capitalize(date)} · ${time}\n` +
      `*${space}* · ${owner} · ${useTypeLabel}` +
      (data.title ? `\n_${data.title}_` : "") +
      (actorName ? `\n_por ${actorName}_` : "") +
      `\n<${link}|Ver detalle>`;

    await sendChannelMessage(channelText);

    if (
      (event === "approved" || event === "rejected") &&
      data.creator?.slack_user_id
    ) {
      const dmText =
        event === "approved"
          ? `✅ Tu reserva del ${date} en *${space}* (${time}) fue aprobada.\n<${link}|Ver detalle>`
          : `❌ Tu reserva del ${date} en *${space}* (${time}) fue rechazada.\n<${link}|Ver detalle>`;
      await sendDirectMessage(data.creator.slack_user_id, dmText);
    }

    // Reserva pendiente de aprobación: DM personal a pastor_sede +
    // super_admin con slack_user_id mapeado (excluye al creador si es
    // uno de ellos, para no auto-notificarse).
    if (event === "created" && data.status === "requested") {
      const { data: approversWithSlack } = await admin
        .from("profiles")
        .select("id, slack_user_id")
        .in("role", APPROVER_ROLES_FOR_DM)
        .not("slack_user_id", "is", null)
        .neq("id", data.created_by);

      const dmText =
        `🔔 *Nueva reserva por aprobar*\n` +
        `${capitalize(date)} · ${time}\n` +
        `*${space}* · ${useTypeLabel}` +
        (data.ministry?.name ? ` · ${data.ministry.name}` : "") +
        (data.title ? `\n_${data.title}_` : "") +
        `\n<${link}|Ver y aprobar>`;

      await Promise.all(
        (approversWithSlack ?? []).map((s) =>
          s.slack_user_id ? sendDirectMessage(s.slack_user_id, dmText) : null
        )
      );
    }
  } catch (err) {
    console.error("[notify] error inesperado:", err);
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

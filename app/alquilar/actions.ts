"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";
import { createServiceClient } from "@/lib/supabase/service";
import { parseBogotaDatetimeLocal } from "@/lib/datetime";
import { formatCents } from "@/lib/money";
import { sendChannelMessage } from "@/lib/slack";

const PAYMENT_BUCKET = "payment-receipts";
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "application/pdf"]);
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/pdf": "pdf",
};

function back(params: Record<string, string>): never {
  redirect(`/alquilar?${new URLSearchParams(params).toString()}`);
}

function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 3_600_000;
}

export async function submitExternalBookingAction(formData: FormData) {
  // ─── Parseo y validación ────────────────────────────────────────────
  const spaceId = String(formData.get("space_id") ?? "").trim();
  const startsRaw = String(formData.get("starts_at") ?? "").trim();
  const endsRaw = String(formData.get("ends_at") ?? "").trim();
  const clientName = String(formData.get("client_name") ?? "").trim();
  const clientEmail = String(formData.get("client_email") ?? "").trim();
  const clientPhone = String(formData.get("client_phone") ?? "").trim() || null;
  const eventTitle = String(formData.get("event_title") ?? "").trim() || null;
  const file = formData.get("receipt");

  if (!spaceId || !startsRaw || !endsRaw || !clientName || !clientEmail) {
    back({ error: "Faltan campos obligatorios." });
  }
  if (!/.+@.+\..+/.test(clientEmail)) {
    back({ error: "Email inválido." });
  }
  if (!(file instanceof File) || file.size === 0) {
    back({ error: "Adjunta el comprobante de pago." });
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    back({ error: "El comprobante supera 5 MB." });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    back({ error: "Comprobante debe ser PDF, PNG o JPG." });
  }

  const startsAt = parseBogotaDatetimeLocal(startsRaw);
  const endsAt = parseBogotaDatetimeLocal(endsRaw);
  if (!startsAt || !endsAt) back({ error: "Fechas inválidas." });
  if (endsAt <= startsAt) {
    back({ error: "La hora de fin debe ser posterior a la de inicio." });
  }

  // ─── Items pedidos ──────────────────────────────────────────────────
  type RequestedItem = { itemId: string; quantity: number };
  const requestedItems: RequestedItem[] = [];
  for (const [key, value] of formData.entries()) {
    const match = /^item_qty_([0-9a-f-]{36})$/i.exec(key);
    if (!match) continue;
    const qty = Number(String(value));
    if (!Number.isInteger(qty) || qty <= 0) continue;
    requestedItems.push({ itemId: match[1], quantity: qty });
  }

  // ─── Lookups con service_role ───────────────────────────────────────
  const admin = createServiceClient();

  const { data: space } = await admin
    .from("spaces")
    .select("id, name, hourly_rate_cents, status")
    .eq("id", spaceId)
    .maybeSingle();

  if (!space) back({ error: "El espacio seleccionado no existe." });
  if (space.status !== "active" || space.hourly_rate_cents == null) {
    back({ error: "Este espacio no está disponible para alquiler." });
  }

  const { data: rsg } = await admin
    .from("organizations")
    .select("id")
    .eq("name", "RSG")
    .single();
  if (!rsg) back({ error: "No se encontró RSG como organización." });

  // ─── Disponibilidad de items ─────────────────────────────────────────
  let itemPrices = new Map<string, { name: string; price: number }>();
  if (requestedItems.length > 0) {
    const { data: avail, error: availErr } = await admin.rpc(
      "items_available",
      { _starts: startsAt.toISOString(), _ends: endsAt.toISOString() }
    );
    if (availErr) back({ error: `No se pudo verificar inventario: ${availErr.message}` });

    const byItem = new Map((avail ?? []).map((a) => [a.item_id, a]));
    for (const req of requestedItems) {
      const a = byItem.get(req.itemId);
      if (!a) back({ error: "Algún item ya no existe; recarga la página." });
      if (req.quantity > a.available) {
        back({
          error: `No alcanzan los ${a.name}: pediste ${req.quantity}, hay ${a.available} disponibles.`,
        });
      }
    }

    const { data: catalog } = await admin
      .from("rentable_items")
      .select("id, name, unit_price_cents")
      .in(
        "id",
        requestedItems.map((r) => r.itemId)
      );
    itemPrices = new Map(
      (catalog ?? []).map((c) => [c.id, { name: c.name, price: c.unit_price_cents }])
    );
  }

  // ─── Cálculo de total ───────────────────────────────────────────────
  const hours = hoursBetween(startsAt, endsAt);
  const spaceCost = Math.round(hours * space.hourly_rate_cents);
  const itemsCost = requestedItems.reduce(
    (sum, r) => sum + r.quantity * (itemPrices.get(r.itemId)?.price ?? 0),
    0
  );
  const totalCents = spaceCost + itemsCost;

  // ─── Upload del comprobante ─────────────────────────────────────────
  const bookingId = randomUUID();
  const token = randomUUID();
  const ext = MIME_EXT[file.type] ?? "bin";
  const receiptPath = `${bookingId}/receipt.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from(PAYMENT_BUCKET)
    .upload(receiptPath, file, { contentType: file.type, upsert: true });
  if (uploadErr) {
    back({ error: `No se pudo subir el comprobante: ${uploadErr.message}` });
  }

  // ─── Insert booking + items ─────────────────────────────────────────
  const { error: insertErr } = await admin.from("bookings").insert({
    id: bookingId,
    space_id: space.id,
    owner_org_id: rsg.id,
    use_type: "externo",
    title: eventTitle,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "requested",
    is_external: true,
    client_name: clientName,
    client_email: clientEmail,
    client_phone: clientPhone,
    client_token: token,
    total_cents: totalCents,
    payment_receipt_url: receiptPath,
    payment_status: "pending",
  });

  if (insertErr) {
    await admin.storage.from(PAYMENT_BUCKET).remove([receiptPath]);
    if (insertErr.code === "23P01") {
      back({
        error:
          "Ese horario choca con otra reserva. Elige otra franja y vuelve a enviar (incluye un nuevo comprobante).",
      });
    }
    back({ error: `No se pudo registrar la reserva: ${insertErr.message}` });
  }

  if (requestedItems.length > 0) {
    const rows = requestedItems.map((r) => ({
      booking_id: bookingId,
      item_id: r.itemId,
      quantity: r.quantity,
      unit_price_cents_snapshot: itemPrices.get(r.itemId)?.price ?? 0,
    }));
    const { error: itemsErr } = await admin.from("booking_items").insert(rows);
    if (itemsErr) {
      await admin.storage.from(PAYMENT_BUCKET).remove([receiptPath]);
      await admin.from("bookings").delete().eq("id", bookingId);
      back({ error: `No se pudo registrar items: ${itemsErr.message}` });
    }
  }

  // ─── Notificación a Slack ───────────────────────────────────────────
  const siteUrl =
    process.env.SITE_URL ?? "https://rsg-reservas.vercel.app";
  const detailLink = `${siteUrl}/reservas/${bookingId}`;
  await sendChannelMessage(
    `💰 *Reserva externa por aprobar*\n` +
      `${clientName} (${clientEmail}) — *${space.name}*\n` +
      `${startsRaw.replace("T", " ")} → ${endsRaw.replace("T", " ")}\n` +
      `Total: *${formatCents(totalCents)}*\n` +
      `<${detailLink}|Verificar pago y aprobar>`
  );

  revalidatePath("/calendario");
  revalidatePath("/aprobaciones");
  redirect(`/alquilar/exito?token=${token}`);
}

import { type NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { donMutate } from "@/app/donaciones/_lib/data";
import type { Donacion } from "@/app/donaciones/_lib/types";

function sameSecret(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

async function sha256hex(message: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normNombre(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function donorKey(doc: string, email: string, nombre: string): string {
  const id = doc ? `c:${doc}` : email ? `e:${email.toLowerCase()}` : `n:${normNombre(nombre)}`;
  return createHash("md5").update(id).digest("hex").substring(0, 12);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  let evento: Record<string, unknown>;
  try { evento = JSON.parse(raw); }
  catch { return NextResponse.json({ ok: false, error: "cuerpo inválido" }, { status: 400 }); }

  // ── 1. Validar firma (misma lógica que webhook-wompi.php) ───────────
  // Sin secreto no hay forma de saber si el evento viene de Wompi: se rechaza.
  const secret = process.env.WOMPI_EVENTS_SECRET ?? "";
  if (!secret) {
    return NextResponse.json({ ok: false, error: "WOMPI_EVENTS_SECRET no configurado" }, { status: 500 });
  }
  {
    const firma = (evento.signature ?? {}) as { properties?: string[]; checksum?: string };
    const timestamp = String(evento.timestamp ?? "");
    if (!firma.properties?.length || !firma.checksum || !timestamp) {
      return NextResponse.json({ ok: false, error: "firma incompleta" }, { status: 400 });
    }
    const data = (evento.data ?? {}) as Record<string, unknown>;
    let cadena = "";
    for (const ruta of firma.properties) {
      let valor: unknown = data;
      for (const parte of ruta.split(".")) {
        valor = (valor as Record<string, unknown>)?.[parte] ?? "";
      }
      cadena += typeof valor === "string" || typeof valor === "number" ? String(valor) : "";
    }
    cadena += timestamp + secret;
    const checksum = await sha256hex(cadena);
    if (!sameSecret(checksum.toLowerCase(), firma.checksum.toLowerCase())) {
      return NextResponse.json({ ok: false, error: "firma inválida" }, { status: 401 });
    }
  }

  // ── 2. Solo transaction.updated APPROVED ───────────────────────────
  if (evento.event !== "transaction.updated") {
    return NextResponse.json({ ok: true, nota: "ignorado" });
  }
  const tx = ((evento.data as Record<string, unknown>)?.transaction ?? {}) as Record<string, unknown>;
  if (String(tx.status ?? "") !== "APPROVED") {
    return NextResponse.json({ ok: true, nota: "no aprobada" });
  }
  const id = String(tx.id ?? "");
  if (!id) return NextResponse.json({ ok: false, error: "sin id" }, { status: 400 });

  // ── 3. Datos enriquecidos enviados por el PHP (header X-Rsg-Fila) ──
  // El PHP ya calculó nombre, tipo, email, cedula al procesar el evento.
  // Ese header no está cubierto por la firma de Wompi, así que solo se usa
  // si viene con la llave compartida del PHP (X-Rsg-Token = EFECTIVO_TOKEN).
  let fila: Record<string, string> = {};
  const phpToken = process.env.EFECTIVO_TOKEN ?? "";
  const reqToken = req.headers.get("x-rsg-token") ?? "";
  if (phpToken && sameSecret(reqToken, phpToken)) {
    try {
      const h = req.headers.get("x-rsg-fila");
      if (h) fila = JSON.parse(h);
    } catch {}
  }

  const customerData = (tx.customer_data ?? {}) as Record<string, unknown>;
  const nombre  = fila.nombre      || String(customerData.full_name   ?? "Sin nombre");
  const email   = fila.email       || String(tx.customer_email        ?? "");
  const doc     = fila.cedula      || String(customerData.legal_id    ?? "");
  const tipo    = fila.tipo        || "";
  const met     = String(tx.payment_method_type ?? fila.metodo_pago   ?? "");
  const ref     = String(tx.reference            ?? fila.referencia   ?? "");
  const monto   = Math.round(Number(tx.amount_in_cents ?? 0) / 100)
                  || Math.round(parseFloat(fila.monto || "0"));
  const fechaRaw = String(tx.finalized_at ?? tx.created_at ?? new Date().toISOString());

  const k = donorKey(doc, email, nombre);

  const nueva: Donacion = {
    id, f: fechaRaw, m: monto, n: nombre, k,
    t: tipo, o: "Módulo Dar", met,
    ...(email && { e: email }),
    ...(doc   && { doc }),
    ...(ref   && { ref }),
  };

  // ── 4. Dedup e insertar en Supabase ─────────────────────────────────
  const yaRegistrada = await donMutate((actuales) =>
    actuales.some((d) => d.id === id)
      ? { donaciones: null, result: true }
      : { donaciones: [nueva, ...actuales].sort((a, b) => b.f.localeCompare(a.f)), result: false },
  );

  return NextResponse.json(yaRegistrada ? { ok: true, nota: "ya registrada" } : { ok: true });
}

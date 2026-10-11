import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

type FilaEfectivo = {
  id: string;
  fecha: string;
  // Acepta número directo o string con formato colombiano "$20.000,00"
  monto: number | string;
  tipo?: string;
  nombre?: string;
  documento?: string;
};

function parseMonto(v: number | string): number {
  if (typeof v === "number") return Math.round(v);
  // "$20.000,00" → 20000
  const clean = String(v).replace(/[^0-9,]/g, "").replace(",", ".");
  return Math.round(parseFloat(clean) || 0);
}

type Payload = {
  token: string;
  filas: FilaEfectivo[];
};

function concepto(t: string): string {
  const n = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const d = n.includes("diezmo");
  const o = n.includes("ofrenda");
  if (d && o) return "Diezmo + Ofrenda";
  if (d) return "Diezmo";
  if (o) return "Ofrenda";
  if (n.includes("casa")) return "Pro Casa";
  return t.trim();
}

function docReal(d: string): string {
  const clean = d.replace(/\D+/g, "");
  if (clean.length < 5) return "";
  if (/^(\d)\1+$/.test(clean)) return "";
  if (["123456789", "1234567890", "12345678", "987654321"].includes(clean)) return "";
  return clean;
}

export async function POST(req: NextRequest) {
  const token = process.env.EFECTIVO_TOKEN ?? "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "EFECTIVO_TOKEN no configurado" }, { status: 500 });
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  if (!body.token || body.token !== token) {
    return NextResponse.json({ ok: false, error: "Llave incorrecta" }, { status: 401 });
  }

  if (!Array.isArray(body.filas)) {
    return NextResponse.json({ ok: false, error: "Faltan las filas" }, { status: 400 });
  }

  const nuevas = body.filas
    .filter((x) => x.id && parseMonto(x.monto) > 0 && x.fecha && !isNaN(Date.parse(x.fecha)))
    .map((x) => ({
      id: `EFE-${x.id.replace(/[^A-Za-z0-9_-]/g, "")}`,
      f: new Date(x.fecha).toISOString().slice(0, 10),
      m: parseMonto(x.monto),
      n: (x.nombre ?? "").trim().replace(/\s+/g, " ").slice(0, 120),
      k: concepto(x.tipo ?? ""),
      t: "efectivo" as const,
      met: "Efectivo",
      di: null as null,
      gid: null as null,
    }));

  if (nuevas.length === 0) {
    return NextResponse.json({ ok: true, importadas: 0, omitidas: body.filas.length });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient();
  const donTable = (service as any).from("donaciones_data");

  const { data: existing } = await donTable.select("donaciones").eq("id", "main").maybeSingle();
  const actuales: { id: string }[] = (existing?.donaciones as { id: string }[] | null) ?? [];
  const existentesSet = new Set(actuales.map((d) => d.id));

  const toInsert = nuevas.filter((d) => !existentesSet.has(d.id));
  const omitidas = nuevas.length - toInsert.length;

  if (toInsert.length > 0) {
    const merged = [...actuales, ...toInsert].sort((a, b) =>
      ("f" in b ? (b as { f: string }).f : "") > ("f" in a ? (a as { f: string }).f : "") ? 1 : -1
    );
    await donTable.upsert({ id: "main", donaciones: merged, updated_at: new Date().toISOString() });
  }

  return NextResponse.json({ ok: true, importadas: toInsert.length, omitidas });
}

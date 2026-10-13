import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Donacion } from "@/app/donaciones/_lib/types";

const KEEP = new Set(["id","f","m","n","k","t","o","met","di","gid","e","doc","ref"]);

function limpiar(r: Record<string, unknown>): Donacion {
  const out: Record<string, unknown> = {};
  KEEP.forEach((k) => { if (r[k] !== undefined) out[k] = r[k]; });
  return out as Donacion;
}

export async function POST(req: NextRequest) {
  const token = process.env.EFECTIVO_TOKEN ?? "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "EFECTIVO_TOKEN no configurado" }, { status: 500 });
  }

  let body: { token: string; filas: unknown[] };
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

  const validas = (body.filas as Record<string, unknown>[])
    .filter((r) => r.id && typeof r.m === "number" && r.m > 0 && r.f && r.n)
    .map(limpiar);

  if (validas.length === 0) {
    return NextResponse.json({ ok: true, importadas: 0, omitidas: body.filas.length });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient();
  const donTable = (service as any).from("donaciones_data");

  const { data: existing } = await donTable.select("donaciones").eq("id", "main").maybeSingle();
  const actuales: Donacion[] = (existing?.donaciones as Donacion[] | null) ?? [];
  const existentesSet = new Set(actuales.map((d: Donacion) => d.id));

  const nuevas = validas.filter((d) => !existentesSet.has(d.id));
  const omitidas = validas.length - nuevas.length;

  if (nuevas.length > 0) {
    const merged = [...actuales, ...nuevas].sort((a, b) => b.f.localeCompare(a.f));
    await donTable.upsert({ id: "main", donaciones: merged, updated_at: new Date().toISOString() });
  }

  return NextResponse.json({ ok: true, importadas: nuevas.length, omitidas });
}

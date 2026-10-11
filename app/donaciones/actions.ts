"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Donacion } from "./_lib/types";

async function assertAccess(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["super_admin", "pastor_sede"].includes(profile?.role ?? "")) {
    throw new Error("Sin acceso al módulo de donaciones");
  }
}

// eslint-disable-next-line
const donTable = (svc: ReturnType<typeof createServiceClient>) => (svc as any).from("donaciones_data");

export async function donReadData(): Promise<Donacion[]> {
  const service = createServiceClient();
  const { data } = await donTable(service).select("donaciones").eq("id", "main").maybeSingle();
  return (data?.donaciones as Donacion[] | null) ?? [];
}

export async function donImportarAction(fd: FormData): Promise<{ importadas: number; repetidas: number }> {
  await assertAccess();
  const raw = String(fd.get("datos") ?? "");
  let filas: Donacion[];
  try { filas = JSON.parse(raw); } catch { throw new Error("El JSON no es válido"); }
  if (!Array.isArray(filas)) throw new Error("Se esperaba un arreglo de donaciones");

  const service = createServiceClient();
  const { data } = await donTable(service).select("donaciones").eq("id", "main").maybeSingle();
  const actuales: Donacion[] = (data?.donaciones as Donacion[] | null) ?? [];
  const existentes = new Set(actuales.map((d) => d.id));

  const validas = filas.filter((r) => r.id && r.m > 0 && r.f && r.n);
  const nuevas  = validas.filter((r) => !existentes.has(r.id));
  const repetidas = validas.length - nuevas.length;

  if (nuevas.length > 0) {
    const merged = [...actuales, ...nuevas].sort((a, b) => b.f.localeCompare(a.f));
    await donTable(service).upsert({ id: "main", donaciones: merged, updated_at: new Date().toISOString() });
    revalidatePath("/donaciones");
  }
  return { importadas: nuevas.length, repetidas };
}

export async function donBorrarTodoAction(): Promise<void> {
  await assertAccess();
  const service = createServiceClient();
  await donTable(service).upsert({ id: "main", donaciones: [], updated_at: new Date().toISOString() });
  revalidatePath("/donaciones");
}

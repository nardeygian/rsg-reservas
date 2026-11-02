"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Donacion } from "./_lib/types";
import { donMutate } from "./_lib/data";
import { cargarCandidatos, donVincular, vincularEnLista } from "./_lib/vincular";

async function assertAccess(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["super_admin", "pastor_sede"].includes(profile?.role ?? "")) {
    throw new Error("Sin acceso al módulo de donaciones");
  }
}


// ── Actions ────────────────────────────────────────────────────────────────

export async function donImportarAction(fd: FormData): Promise<{ importadas: number; repetidas: number; autovinculadas: number; sin_match: number }> {
  await assertAccess();
  const raw = String(fd.get("datos") ?? "");
  let filas: Donacion[];
  try { filas = JSON.parse(raw); } catch { throw new Error("El JSON no es válido"); }
  if (!Array.isArray(filas)) throw new Error("Se esperaba un arreglo de donaciones");

  const KEEP = new Set(["id","f","m","n","k","t","o","met","di","gid","sg","e","doc","ref"]);
  const limpiar = (r: Record<string, unknown>): Donacion => {
    const out: Record<string, unknown> = {};
    KEEP.forEach(k => { if (r[k] !== undefined) out[k] = r[k]; });
    return out as Donacion;
  };
  const validas = filas.filter((r: Record<string, unknown>) => r.id && (r.m as number) > 0 && r.f && r.n);

  const service = createServiceClient();
  const candidatos = await cargarCandidatos(service);

  const res = await donMutate((actuales) => {
    const existentes = new Set(actuales.map((d) => d.id));
    const nuevas  = validas.filter((r: Record<string, unknown>) => !existentes.has(r.id as string)).map(limpiar);
    const repetidas = validas.length - nuevas.length;
    if (nuevas.length === 0) {
      return { donaciones: null, result: { importadas: 0, repetidas, autovinculadas: 0, sin_match: 0 } };
    }

    // Auto-vincular nuevas donaciones antes de guardar
    const nuevasIds = new Set(nuevas.map(d => d.id));
    const merged = [...actuales, ...nuevas].sort((a, b) => b.f.localeCompare(a.f));
    const { donaciones, vinculadas: autovinculadas, sin_match } = vincularEnLista(merged, candidatos, nuevasIds);
    return { donaciones, result: { importadas: nuevas.length, repetidas, autovinculadas, sin_match } };
  });

  if (res.importadas > 0) revalidatePath("/donaciones");
  return res;
}

export async function donVincularAction(): Promise<{ vinculadas: number; sin_match: number }> {
  await assertAccess();
  const res = await donVincular();
  if (res.vinculadas > 0) revalidatePath("/donaciones");
  return res;
}

export async function donVincularManualAction(donId: string, di: string, gid: string): Promise<void> {
  await assertAccess();
  await donMutate((actuales) => ({
    donaciones: actuales.map((d): Donacion => {
      if (d.id !== donId) return d;
      const out: Donacion = { ...d, di, gid, mv: true };
      delete out.ext;
      return out;
    }),
    result: undefined,
  }));
  revalidatePath("/donaciones");
}

export async function donMarcarExternoAction(donId: string): Promise<void> {
  await assertAccess();
  await donMutate((actuales) => ({
    donaciones: actuales.map((d): Donacion => {
      if (d.id !== donId) return d;
      const out: Donacion = { ...d, ext: true };
      delete out.di;
      delete out.gid;
      delete out.sg;
      delete out.mv;
      return out;
    }),
    result: undefined,
  }));
  revalidatePath("/donaciones");
}

export async function donBorrarTodoAction(): Promise<void> {
  await assertAccess();
  await donMutate(() => ({ donaciones: [], result: undefined }));
  revalidatePath("/donaciones");
}

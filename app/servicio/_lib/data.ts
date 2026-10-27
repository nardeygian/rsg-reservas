import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { SvData } from "./types";

// Lecturas con service_role, sin chequeo de permisos: quien las llame decide
// qué parte de los datos puede ver el usuario. "server-only" impide que este
// módulo termine en el bundle del cliente, y al no estar en un archivo
// "use server" no se expone como server action.

export const DEFAULT_DATA: SvData = {
  reuniones: {}, servidores: {}, registros: {}, sync: 0, sync_error: "", grupos: {}, miembros: {},
};

// servicio_data not in generated types yet (migration pending).
// eslint-disable-next-line
export const svTable = (svc: ReturnType<typeof createServiceClient>) => (svc as any).from("servicio_data");

// Migrates old single lider_user_id → lider_user_ids array on first read.
export function normalizeSvData(d: SvData): SvData {
  for (const g of Object.values(d.grupos ?? {})) {
    const raw = g as Record<string, unknown>;
    if (!Array.isArray(g.lider_user_ids)) {
      g.lider_user_ids = raw["lider_user_id"] ? [raw["lider_user_id"] as string] : [];
    }
  }
  return d;
}

export async function svReadData(): Promise<SvData> {
  const service = createServiceClient();
  const { data } = await svTable(service).select("data").eq("id", "main").maybeSingle();
  return normalizeSvData((data?.data as SvData | null) ?? { ...DEFAULT_DATA });
}


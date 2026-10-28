import "server-only";

export type Proveedor = "google" | "apple";

export const PROVEEDORES: { id: Proveedor; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "apple", label: "Apple" },
];

export function esProveedor(v: unknown): v is Proveedor {
  return v === "google" || v === "apple";
}

// Qué proveedores tiene activos Supabase Auth (GET /auth/v1/settings).
// Se configuran en el panel de Supabase (o en supabase/config.toml en
// local), nunca con claves en el código.
export async function proveedoresActivos(): Promise<Record<Proveedor, boolean>> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as { external?: Record<string, boolean> };
    return { google: json.external?.google === true, apple: json.external?.apple === true };
  } catch {
    return { google: false, apple: false };
  }
}

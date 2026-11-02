import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Destino "Servir" de la navegación: Planeación entra a Reuniones; los demás,
// a sus servicios.
export default async function ServirPage() {
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims.sub) redirect("/login?next=/servir");
  const { data: planea } = await db.rpc("has_permission", { p_permission: "servir.planear" });
  redirect(planea ? "/servir/reuniones" : "/servir/mis-servicios");
}

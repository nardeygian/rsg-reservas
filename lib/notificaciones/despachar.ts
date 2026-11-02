// Solo servidor: usa NOTIFICADOR_SECRET o la llave service_role.
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

// Pide al `notificador` que despache ya (sin esperar la vuelta de pg_cron).
// Best-effort: la base también lo pide al crear el envío (trigger con
// pg_net, 20261030100000) y pg_cron lo recoge si todo falla.
//
// Con NOTIFICADOR_URL y NOTIFICADOR_SECRET llama directo a la Edge Function.
// Sin ellas, le pide a la base que la llame (notificador_disparar usa la URL
// y el secreto de su Vault), con la llave service_role que el portal ya
// tiene. Así un envío inmediato sale al instante aunque falten esas dos
// variables en Vercel.
export async function despacharAhora(): Promise<void> {
  const url = process.env.NOTIFICADOR_URL;
  const secret = process.env.NOTIFICADOR_SECRET;
  try {
    if (url && secret) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-notificador-secret": secret },
        body: "{}",
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      if (!res.ok) console.error("[notificaciones] notificador respondió", res.status);
      return;
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    const { error } = await createServiceClient().rpc("notificador_disparar");
    if (error) console.error("[notificaciones] no se pudo pedir el despacho a la base:", error.message);
  } catch (err) {
    console.error("[notificaciones] no se pudo llamar al notificador:", err);
  }
}

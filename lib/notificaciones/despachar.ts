// Solo servidor: usa NOTIFICADOR_SECRET.

// Pide al `notificador` que despache ya (sin esperar la vuelta de pg_cron).
// Best-effort: si falla, pg_cron lo recoge en menos de 5 minutos.
//
// NOTIFICADOR_URL:    <SUPABASE_URL>/functions/v1/notificador
// NOTIFICADOR_SECRET: el mismo secreto que tiene la Edge Function.
export async function despacharAhora(): Promise<void> {
  const url = process.env.NOTIFICADOR_URL;
  const secret = process.env.NOTIFICADOR_SECRET;
  if (!url || !secret) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-notificador-secret": secret },
      body: "{}",
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) console.error("[notificaciones] notificador respondió", res.status);
  } catch (err) {
    console.error("[notificaciones] no se pudo llamar al notificador:", err);
  }
}

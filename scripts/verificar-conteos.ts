// Compara los conteos de servicio de la base (vista service_units y tabla
// attendance) con el cálculo de la app actual sobre servicio_data (svConteo).
// Tienen que dar igual para cada servidor: ministerio, Servolución y ausencias.
//
// Uso (después de scripts/migrar-servicio.ts):
//   DESTINO_URL=… DESTINO_KEY=… node scripts/verificar-conteos.ts --desde archivo.json

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { enrichReuniones, svConteo } from "../app/servicio/_lib/sv-logic.ts";
import type { SvData } from "../app/servicio/_lib/types.ts";

const args = process.argv.slice(2);
const desde = args[args.indexOf("--desde") + 1];
if (!args.includes("--desde") || !desde) throw new Error("Falta --desde archivo.json");
const raw = JSON.parse(readFileSync(desde, "utf8"));
const sv = (Array.isArray(raw) ? raw[0].data : raw.data ?? raw) as SvData;

const db = createClient(process.env.DESTINO_URL!, process.env.DESTINO_KEY!, { auth: { persistSession: false } });

const antes = svConteo(enrichReuniones(sv));

const { data: personas, error: e1 } = await db.from("people").select("id, full_name, legacy_servant_id").not("legacy_servant_id", "is", null);
const { data: unidades, error: e2 } = await db.from("service_units").select("person_id, counting");
const { data: ausencias, error: e3 } = await db.from("attendance").select("person_id").eq("status", "ausente");
if (e1 || e2 || e3) throw new Error((e1 ?? e2 ?? e3)!.message);

const contar = (filas: { person_id: string; counting?: string }[], c?: string) => {
  const m = new Map<string, number>();
  for (const f of filas) if (!c || f.counting === c) m.set(f.person_id, (m.get(f.person_id) ?? 0) + 1);
  return m;
};
const min = contar(unidades!, "min"), serv = contar(unidades!, "serv"), aus = contar(ausencias!);

let diferencias = 0, tot = { min: 0, serv: 0, aus: 0 };
for (const p of personas!) {
  const a = antes.get(p.legacy_servant_id!);
  const esperado = { min: a?.min.size ?? 0, serv: a?.serv.size ?? 0, aus: a?.aus.size ?? 0 };
  const nuevo = { min: min.get(p.id) ?? 0, serv: serv.get(p.id) ?? 0, aus: aus.get(p.id) ?? 0 };
  tot.min += nuevo.min; tot.serv += nuevo.serv; tot.aus += nuevo.aus;
  if (esperado.min !== nuevo.min || esperado.serv !== nuevo.serv || esperado.aus !== nuevo.aus) {
    diferencias++;
    console.log(`✗ ${p.full_name}: app ${JSON.stringify(esperado)} · base ${JSON.stringify(nuevo)}`);
  }
}
console.log(`${diferencias ? "✗" : "✓"} ${personas!.length} servidores · ${diferencias} con diferencias · totales base: ${tot.min} ministerio, ${tot.serv} Servolución, ${tot.aus} ausencias`);
process.exit(diferencias ? 1 : 0);

// Copia servicio_data (el JSON del módulo Servicio) a las tablas de Servir:
//   grupos      → discipleship_groups
//   miembros    → people (legacy_disciple_id)
//   servidores  → people: se une al discípulo con el mismo cruce de nombres
//                 que usa la app hoy (svDiOf); si no hay, persona nueva
//                 (legacy_servant_id)
//   reuniones   → meetings (legacy_id, tipo con lib/servir/clasificar.ts)
//   registros   → attendance (source 'legacy') y meetings.notes
//
// Es idempotente: se puede correr las veces que haga falta.
//
// Uso:
//   node scripts/migrar-servicio.ts [--desde archivo.json]
//
// Origen: --desde (exportación de servicio_data) o, si no, se lee producción
// en modo lectura con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
// Destino: DESTINO_URL y DESTINO_KEY (service role). Solo escribe en la base
// local; para producción hace falta --permitir-produccion, y eso solo con
// permiso de Gian.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { svDiOf, svNombreLimpio } from "../app/servicio/_lib/sv-logic.ts";
import type { SvData } from "../app/servicio/_lib/types.ts";
import { clasificarReunion, kindDeReunion, type TipoParaClasificar } from "../lib/servir/clasificar.ts";

const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

function fallar(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function leerOrigen(): Promise<SvData> {
  const desde = arg("--desde");
  if (desde) {
    const raw = JSON.parse(readFileSync(desde, "utf8"));
    return (Array.isArray(raw) ? raw[0].data : raw.data ?? raw) as SvData;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fallar("Falta --desde o NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const { data, error } = await createClient(url, key).from("servicio_data").select("data").eq("id", "main").single();
  if (error) fallar(`No pude leer servicio_data: ${error.message}`);
  return data.data as SvData;
}

function destino() {
  const url = process.env.DESTINO_URL, key = process.env.DESTINO_KEY;
  if (!url || !key) fallar("Faltan DESTINO_URL y DESTINO_KEY");
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url);
  if (!local && !args.includes("--permitir-produccion")) {
    fallar(`${url} no es la base local. Producción solo con --permitir-produccion y permiso de Gian.`);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function ok<T>(r: { data: T; error: { message: string } | null }, que: string): NonNullable<T> {
  if (r.error) fallar(`${que}: ${r.error.message}`);
  return r.data as NonNullable<T>;   // los upsert sin select devuelven null y no se usan
}

const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

async function main() {
  const sv = await leerOrigen();
  const db = destino();
  const miembros = sv.miembros ?? {};
  const grupos = sv.grupos ?? {};

  // ── Grupos de discipulado ──
  const filasGrupos = Object.values(grupos).map((g) => {
    const raw = g as unknown as Record<string, unknown>;
    const lideres = Array.isArray(g.lider_user_ids) ? g.lider_user_ids : raw.lider_user_id ? [raw.lider_user_id as string] : [];
    return { id: g.id, name: g.nombre, leader_user_ids: lideres };
  });
  if (filasGrupos.length) ok(await db.from("discipleship_groups").upsert(filasGrupos), "grupos");

  // ── Discípulos ──
  const filasDisc = Object.values(miembros).map((m) => ({
    legacy_disciple_id: m.id,
    full_name: m.nombre.trim(),
    discipleship_group_id: m.grupo_id && grupos[m.grupo_id] ? m.grupo_id : null,
  }));
  if (filasDisc.length) ok(await db.from("people").upsert(filasDisc, { onConflict: "legacy_disciple_id" }), "discípulos");

  const personas = ok(await db.from("people").select("id, legacy_disciple_id, legacy_servant_id"), "personas");
  const porDiscipulo = new Map(personas.filter((p) => p.legacy_disciple_id).map((p) => [p.legacy_disciple_id as string, p]));
  const porServidor = new Map(personas.filter((p) => p.legacy_servant_id).map((p) => [p.legacy_servant_id as string, p]));

  // ── Servidores ──
  const personaDeServidor = new Map<string, string>();
  const unidos: string[] = [], nuevos: string[] = [], choques: string[] = [];
  for (const s of Object.values(sv.servidores)) {
    const ya = porServidor.get(s.id);
    if (ya) { personaDeServidor.set(s.id, ya.id); continue; }

    const di = svDiOf(s, miembros);
    const disc = di ? porDiscipulo.get(di) : undefined;
    if (disc && !disc.legacy_servant_id) {
      ok(await db.from("people").update({ legacy_servant_id: s.id }).eq("id", disc.id), `servidor ${s.nombre}`);
      disc.legacy_servant_id = s.id;
      personaDeServidor.set(s.id, disc.id);
      unidos.push(`${s.nombre} → ${miembros[di!].nombre}`);
      continue;
    }
    if (disc) choques.push(`${s.nombre} coincide con ${miembros[di!].nombre}, que ya está unido a otro servidor`);
    const nueva = ok(
      await db.from("people").insert({ full_name: s.nombre.trim(), legacy_servant_id: s.id }).select("id").single(),
      `servidor ${s.nombre}`,
    );
    personaDeServidor.set(s.id, nueva.id);
    nuevos.push(s.nombre);
  }

  // ── Reuniones ──
  const tipos = ok(await db.from("meeting_types").select("id, name, sort, kind, asana_rules"), "tipos") as unknown as TipoParaClasificar[];
  const sinTipo = new Map<string, number>();
  const porTipo = new Map<string, number>();
  const filasReu = Object.values(sv.reuniones).map((r) => {
    const tipo = clasificarReunion(r, tipos);
    const nombre = svNombreLimpio(r.nombre);
    if (tipo) porTipo.set(tipo.name, (porTipo.get(tipo.name) ?? 0) + 1);
    else sinTipo.set(`${nombre} @ ${r.seccion || "—"}`, (sinTipo.get(`${nombre} @ ${r.seccion || "—"}`) ?? 0) + 1);
    const reg = sv.registros[r.id];
    return {
      legacy_id: r.id,
      asana_gid: r.origen === "asana" ? r.id : null,
      name: nombre,
      meeting_date: r.fecha,
      section: r.seccion || null,
      meeting_type_id: tipo?.id ?? null,
      kind: kindDeReunion(r, tipo),
      origin: r.origen === "asana" ? "asana" : "manual",
      outside_asana: !!r.fuera_de_asana,
      status: reg || r.fecha < hoy ? "cerrada" : "publicada",
      notes: reg?.nota || null,
      attendance_closed_at: reg?.cuando ?? null,
    };
  });
  if (filasReu.length) ok(await db.from("meetings").upsert(filasReu, { onConflict: "legacy_id" }), "reuniones");

  const reuniones = ok(await db.from("meetings").select("id, legacy_id").not("legacy_id", "is", null), "reuniones");
  const reunionDe = new Map(reuniones.map((m) => [m.legacy_id as string, m.id]));

  // ── Asistencia ──
  // Una fila por persona y reunión: si dos servidores caen en la misma
  // persona, se juntan los roles y basta con que uno asistiera.
  const asistencia = new Map<string, { meeting_id: string; person_id: string; status: string; roles: string[]; note: string | null; source: string; confirmed_at: string }>();
  const huerfanas: string[] = [];
  for (const [rid, reg] of Object.entries(sv.registros)) {
    const meeting_id = reunionDe.get(rid);
    if (!meeting_id) { huerfanas.push(`registro ${rid} sin reunión`); continue; }
    for (const f of reg.filas) {
      const person_id = personaDeServidor.get(f.sid);
      if (!person_id) { huerfanas.push(`fila ${f.sid} en ${rid} sin servidor`); continue; }
      const k = `${meeting_id}|${person_id}`;
      const prev = asistencia.get(k);
      const status = f.aus ? "ausente" : "asistio";
      if (prev) {
        prev.roles = [...new Set([...prev.roles, ...(f.roles ?? [])])];
        if (status === "asistio") prev.status = "asistio";
        if (f.nota) prev.note = [prev.note, f.nota].filter(Boolean).join(" · ");
      } else {
        asistencia.set(k, { meeting_id, person_id, status, roles: f.roles ?? [], note: f.nota || null, source: "legacy", confirmed_at: reg.cuando });
      }
    }
  }
  const filasAsis = [...asistencia.values()];
  if (filasAsis.length) ok(await db.from("attendance").upsert(filasAsis, { onConflict: "meeting_id,person_id" }), "asistencia");

  // ── Informe ──
  console.log(`✓ Grupos: ${filasGrupos.length} · Discípulos: ${filasDisc.length} · Servidores: ${Object.keys(sv.servidores).length} (${unidos.length} unidos a un discípulo ahora, ${nuevos.length} personas nuevas)`);
  console.log(`✓ Reuniones: ${filasReu.length} · Asistencia: ${filasAsis.length} filas de ${Object.keys(sv.registros).length} listados`);
  console.log("\nPor tipo:");
  for (const [t, n] of [...porTipo].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${t}`);
  if (sinTipo.size) {
    console.log("\nSin tipo (se pueden clasificar a mano):");
    for (const [t, n] of sinTipo) console.log(`  ${String(n).padStart(3)}  ${t}`);
  }
  for (const c of choques) console.log(`⚠ ${c}`);
  for (const h of huerfanas) console.log(`⚠ ${h}`);
}

main().catch((e) => fallar(e instanceof Error ? e.message : String(e)));

// Semilla local del frente B3 (Equipos y asignaciones): usuarios de prueba,
// áreas, posiciones, checklists y equipos sobre las personas ya migradas.
//
// Solo para la base local. Es idempotente: se puede correr las veces que
// haga falta.
//
// Uso:
//   node --env-file=.env.local scripts/semilla-b3-equipos.ts
//
// Usuarios que crea (todos con la contraseña de B3_PASSWORD, por defecto la
// de abajo; son cuentas de prueba de la base local, nunca reales):
//   b3.lider.lmrsg@rsg.test     líder de departamento de LMRSG
//   b3.lider.voces@rsg.test     líder del área Voces (LMRSG)
//   b3.lider.protocolo@rsg.test líder de departamento de Protocolo
//   b3.servidor@rsg.test        servidor de LMRSG (Banda) y Protocolo

import { createClient } from "@supabase/supabase-js";

const PASSWORD = process.env.B3_PASSWORD ?? "servir-b3-local";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url)) throw new Error(`${url} no es la base local`);
const db = createClient(url, key, { auth: { persistSession: false } });

function ok<T>(r: { data: T; error: { message: string } | null }, que: string): NonNullable<T> {
  if (r.error) throw new Error(`${que}: ${r.error.message}`);
  return r.data as NonNullable<T>;
}

async function ministerio(nombre: string): Promise<string> {
  return ok(await db.from("ministries").select("id").eq("name", nombre).single(), nombre).id;
}

async function area(ministryId: string, nombre: string): Promise<string> {
  ok(await db.from("areas").upsert({ ministry_id: ministryId, name: nombre }, { onConflict: "ministry_id,name", ignoreDuplicates: true }), `área ${nombre}`);
  return ok(await db.from("areas").select("id").eq("ministry_id", ministryId).eq("name", nombre).single(), nombre).id;
}

async function posicion(ministryId: string, areaId: string | null, nombre: string, sort: number, checklist: [string, string][] = []): Promise<string> {
  ok(await db.from("positions").upsert({ ministry_id: ministryId, area_id: areaId, name: nombre, sort }, { onConflict: "ministry_id,name", ignoreDuplicates: true }), `posición ${nombre}`);
  const id = ok(await db.from("positions").select("id").eq("ministry_id", ministryId).eq("name", nombre).single(), nombre).id;
  const { count } = await db.from("checklist_templates").select("id", { count: "exact", head: true }).eq("position_id", id);
  if (!count && checklist.length) {
    ok(await db.from("checklist_templates").insert(checklist.map(([moment, text], i) => ({ position_id: id, moment, text, sort: i }))), `checklist ${nombre}`);
  }
  return id;
}

async function persona(nombre: string): Promise<string> {
  const r = ok(await db.from("people").select("id").eq("full_name", nombre).limit(1), nombre);
  if (r[0]) return r[0].id;
  return ok(await db.from("people").insert({ full_name: nombre }).select("id").single(), nombre).id;
}

async function miembro(personId: string, ministryId: string, areaId: string | null, posiciones: string[]) {
  let q = db.from("team_members").select("id").eq("person_id", personId).eq("ministry_id", ministryId);
  q = areaId ? q.eq("area_id", areaId) : q.is("area_id", null);
  if (!ok(await q, "miembro").length) {
    ok(await db.from("team_members").insert({ person_id: personId, ministry_id: ministryId, area_id: areaId }), "miembro");
  }
  if (posiciones.length) {
    ok(await db.from("person_positions").upsert(posiciones.map((position_id) => ({ person_id: personId, position_id })), { ignoreDuplicates: true }), "person_positions");
  }
}

async function usuario(email: string, nombre: string, personId: string): Promise<string> {
  const { data: lista } = await db.auth.admin.listUsers({ perPage: 1000 });
  let id = lista?.users.find((u) => u.email === email)?.id;
  if (!id) {
    const r = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: nombre } });
    if (r.error) throw new Error(`usuario ${email}: ${r.error.message}`);
    id = r.data.user.id;
  }
  ok(await db.from("profiles").update({ full_name: nombre }).eq("id", id), "perfil");
  ok(await db.from("people").update({ profile_id: id }).eq("id", personId), "people.profile_id");
  return id;
}

async function rol(userId: string, role: string, ministryId: string, areaId: string | null = null) {
  const r = ok(await db.from("user_roles").select("id").eq("user_id", userId).eq("role", role).eq("ministry_id", ministryId), "rol");
  if (!r.length) ok(await db.from("user_roles").insert({ user_id: userId, role, ministry_id: ministryId, area_id: areaId }), "rol");
}

async function main() {
  const lmrsg = await ministerio("LMRSG");
  const protocolo = await ministerio("Protocolo");

  const banda = await area(lmrsg, "Banda");
  const voces = await area(lmrsg, "Voces");

  const guitarra = await posicion(lmrsg, banda, "Guitarra eléctrica", 1, [["antes", "Cambiar cuerdas si hace falta"], ["antes", "Afinar y probar pedales"], ["durante", "Seguir al director musical"], ["despues", "Guardar el instrumento"]]);
  const bajo     = await posicion(lmrsg, banda, "Bajo", 2, [["antes", "Afinar"], ["despues", "Guardar cables"]]);
  const bateria  = await posicion(lmrsg, banda, "Batería", 3, [["antes", "Revisar click y retorno"]]);
  const teclado  = await posicion(lmrsg, banda, "Teclado", 4, [["antes", "Cargar los sonidos del repertorio"]]);
  const vozPpal  = await posicion(lmrsg, voces, "Voz principal", 5, [["antes", "Calentar la voz"], ["antes", "Repasar letras y tonos"], ["durante", "Atento a las entradas del coro"]]);
  const coros    = await posicion(lmrsg, voces, "Coros", 6, [["antes", "Repasar armonías"]]);
  const director = await posicion(lmrsg, null, "Director musical", 0, [["antes", "Enviar repertorio a la banda"], ["antes", "Dirigir el ensayo"]]);
  const puerta1  = await posicion(protocolo, null, "Ujier puerta 1", 1, [["antes", "Llegar 45 minutos antes"], ["durante", "Recibir y ubicar a las personas"], ["despues", "Revisar objetos perdidos"]]);
  const puerta2  = await posicion(protocolo, null, "Ujier puerta 2", 2, [["antes", "Llegar 45 minutos antes"]]);
  const ofrenda  = await posicion(protocolo, null, "Ofrendas", 3, [["durante", "Recoger la ofrenda"], ["despues", "Entregar a tesorería"]]);

  // Personas ya migradas (o nuevas si no existen) repartidas en los equipos.
  const nombres = ok(await db.from("people").select("id, full_name").eq("active", true).order("full_name").limit(30), "personas");
  if (nombres.length < 20) throw new Error("Se esperaban las personas migradas; corre primero scripts/migrar-servicio.ts");
  const p = nombres.map((n) => n.id);

  // LMRSG
  await miembro(p[0], lmrsg, null, [director, guitarra]);   // líder de LMRSG
  await miembro(p[1], lmrsg, voces, [vozPpal, coros]);       // líder de Voces
  await miembro(p[2], lmrsg, banda, [guitarra, bajo]);       // el servidor de prueba
  await miembro(p[3], lmrsg, banda, [bateria]);
  await miembro(p[4], lmrsg, banda, [teclado]);
  await miembro(p[5], lmrsg, banda, [bajo, guitarra]);
  await miembro(p[6], lmrsg, voces, [coros]);
  await miembro(p[7], lmrsg, voces, [vozPpal, coros]);
  await miembro(p[8], lmrsg, voces, [coros]);
  await miembro(p[9], lmrsg, banda, [teclado, bateria]);
  // Protocolo
  await miembro(p[10], protocolo, null, [puerta1, puerta2, ofrenda]); // líder de Protocolo
  await miembro(p[2], protocolo, null, [puerta1]);
  for (const i of [11, 12, 13, 14, 15]) await miembro(p[i], protocolo, null, [puerta1, puerta2]);
  await miembro(p[16], protocolo, null, [ofrenda]);

  const liderLmrsg = await usuario("b3.lider.lmrsg@rsg.test", nombres[0].full_name, p[0]);
  const liderVoces = await usuario("b3.lider.voces@rsg.test", nombres[1].full_name, p[1]);
  const servidor   = await usuario("b3.servidor@rsg.test", nombres[2].full_name, p[2]);
  const liderProt  = await usuario("b3.lider.protocolo@rsg.test", nombres[10].full_name, p[10]);

  await rol(liderLmrsg, "lider_departamento", lmrsg);
  await rol(liderVoces, "lider_area", lmrsg, voces);
  await rol(liderProt, "lider_departamento", protocolo);

  // Un bloqueo de ejemplo para que se vea en las sugerencias.
  const { count } = await db.from("availability_blocks").select("id", { count: "exact", head: true }).eq("person_id", p[5]);
  if (!count) {
    ok(await db.from("availability_blocks").insert({ person_id: p[5], starts_on: "2026-11-01", ends_on: "2026-11-30", reason: "Viaje" }), "bloqueo");
  }

  console.log("✓ Semilla B3 lista");
  console.log(`  LMRSG: líder ${nombres[0].full_name}; Voces: ${nombres[1].full_name}; servidor: ${nombres[2].full_name}`);
  console.log(`  Protocolo: líder ${nombres[10].full_name}`);
  void servidor;
}

main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });

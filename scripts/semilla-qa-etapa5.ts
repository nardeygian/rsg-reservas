// Semilla local para el QA de la Etapa 5 (Servir): un usuario por rol,
// equipos con posiciones y checklists, y un discipulado. No depende de los
// datos migrados de servicio_data: sirve sobre una base recién reseteada.
//
// Solo para la base local. Es idempotente: se puede correr las veces que
// haga falta.
//
// Uso:
//   node --env-file=.env.local scripts/semilla-qa-etapa5.ts
//
// Usuarios que crea (todos con la contraseña de QA_PASSWORD, por defecto la
// de abajo; son cuentas de prueba de la base local, nunca reales):
//   qa.planeacion@rsg.test        rol principal planeacion
//   qa.pastor.sede@rsg.test       rol principal pastor_sede
//   qa.lider.depto@rsg.test       líder de departamento de LMRSG
//   qa.lider.area@rsg.test        líder del área Voces (LMRSG)
//   qa.lider.disc@rsg.test        líder del discipulado "Discipulado QA"
//   qa.servidor@rsg.test          servidor de LMRSG (Banda), en el discipulado QA
//   qa.lider.protocolo@rsg.test   líder de departamento de Protocolo (para ver el aislamiento)
//   qa.servidor.protocolo@rsg.test servidor de Protocolo (para ver el aislamiento)

import { createClient } from "@supabase/supabase-js";

const PASSWORD = process.env.QA_PASSWORD ?? "servir-qa-local";

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

async function persona(nombre: string, grupo: string | null = null): Promise<string> {
  const r = ok(await db.from("people").select("id").eq("full_name", nombre).limit(1), nombre);
  if (r[0]) {
    ok(await db.from("people").update({ discipleship_group_id: grupo }).eq("id", r[0].id), nombre);
    return r[0].id;
  }
  return ok(await db.from("people").insert({ full_name: nombre, discipleship_group_id: grupo }).select("id").single(), nombre).id;
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

async function usuario(email: string, nombre: string, rolPrincipal: string, personId: string | null): Promise<string> {
  const { data: lista } = await db.auth.admin.listUsers({ perPage: 1000 });
  let id = lista?.users.find((u) => u.email === email)?.id;
  if (!id) {
    const r = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: nombre } });
    if (r.error) throw new Error(`usuario ${email}: ${r.error.message}`);
    id = r.data.user.id;
  }
  ok(await db.from("profiles").update({ full_name: nombre, role: rolPrincipal, requested_role: null }).eq("id", id), "perfil");
  if (personId) ok(await db.from("people").update({ profile_id: id }).eq("id", personId), "people.profile_id");
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
  const bateria  = await posicion(lmrsg, banda, "Batería", 3, [["antes", "Revisar click y retorno"]]);
  const vozPpal  = await posicion(lmrsg, voces, "Voz principal", 5, [["antes", "Calentar la voz"], ["antes", "Repasar letras y tonos"], ["durante", "Atento a las entradas del coro"]]);
  const coros    = await posicion(lmrsg, voces, "Coros", 6, [["antes", "Repasar armonías"]]);
  const director = await posicion(lmrsg, null, "Director musical", 0, [["antes", "Enviar repertorio a la banda"]]);
  const puerta1  = await posicion(protocolo, null, "Ujier puerta 1", 1, [["antes", "Llegar 45 minutos antes"], ["durante", "Recibir y ubicar a las personas"], ["despues", "Revisar objetos perdidos"]]);

  // Discipulado (los líderes se completan al final, con el id del usuario).
  ok(await db.from("discipleship_groups").upsert({ id: "qa-discipulado", name: "Discipulado QA" }, { onConflict: "id" }), "discipulado");

  const pLiderDepto = await persona("QA Laura Líder LMRSG");
  const pLiderArea  = await persona("QA Andrés Líder Voces");
  const pLiderDisc  = await persona("QA Diana Líder Discipulado");
  const pServidor   = await persona("QA Samuel Servidor", "qa-discipulado");
  const pServProt   = await persona("QA Paula Servidora Protocolo");
  const pLiderProt  = await persona("QA Pedro Líder Protocolo");
  const pVoz        = await persona("QA Valeria Voz", "qa-discipulado");
  const pBateria    = await persona("QA Tomás Batería");
  const pCoros      = await persona("QA Carla Coros", "qa-discipulado");

  await miembro(pLiderDepto, lmrsg, null, [director]);
  await miembro(pLiderArea, lmrsg, voces, [vozPpal, coros]);
  await miembro(pServidor, lmrsg, banda, [guitarra]);
  await miembro(pVoz, lmrsg, voces, [vozPpal]);
  await miembro(pBateria, lmrsg, banda, [bateria]);
  await miembro(pCoros, lmrsg, voces, [coros]);
  await miembro(pLiderProt, protocolo, null, [puerta1]);
  await miembro(pServProt, protocolo, null, [puerta1]);

  await usuario("qa.planeacion@rsg.test", "QA Planeación", "planeacion", null);
  await usuario("qa.pastor.sede@rsg.test", "QA Pastor de Sede", "pastor_sede", null);
  const liderDepto = await usuario("qa.lider.depto@rsg.test", "QA Laura Líder LMRSG", "leader", pLiderDepto);
  const liderArea  = await usuario("qa.lider.area@rsg.test", "QA Andrés Líder Voces", "leader", pLiderArea);
  const liderDisc  = await usuario("qa.lider.disc@rsg.test", "QA Diana Líder Discipulado", "leader", pLiderDisc);
  await usuario("qa.servidor@rsg.test", "QA Samuel Servidor", "servidor", pServidor);
  await usuario("qa.servidor.protocolo@rsg.test", "QA Paula Servidora Protocolo", "servidor", pServProt);
  const liderProt  = await usuario("qa.lider.protocolo@rsg.test", "QA Pedro Líder Protocolo", "leader", pLiderProt);

  await rol(liderDepto, "lider_departamento", lmrsg);
  await rol(liderArea, "lider_area", lmrsg, voces);
  await rol(liderProt, "lider_departamento", protocolo);
  ok(await db.from("discipleship_groups").update({ leader_user_ids: [liderDisc] }).eq("id", "qa-discipulado"), "líder del discipulado");

  console.log("✓ Semilla QA de la Etapa 5 lista (contraseña: QA_PASSWORD o la de este archivo)");
}

main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });

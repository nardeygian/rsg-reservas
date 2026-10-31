// Ambiente de pruebas de Servir: departamentos con roles y checklists,
// líderes y servidores con cuenta, canciones, y dos semanas de reuniones
// (2–3 por semana) con espacios reservados, orden y asignaciones.
//
// Uso (después de semilla-qa-etapa5.ts, que crea los usuarios qa.*):
//   node --env-file=.env.pruebas.local scripts/semilla-ambiente-pruebas.ts
//
// Se puede correr otra vez: borra las reuniones que creó antes (legacy_id
// 'prueba-…') y las vuelve a armar desde hoy. Solo corre contra la base
// local o el proyecto de pruebas, nunca producción.
//
// Cuentas que crea (contraseña QA_PASSWORD):
//   <depto>.lider@rsg.test, <depto>.1@rsg.test, <depto>.2@rsg.test
//   con depto = lmrsg, protocolo, creativos, roadies, semillas, comunidad,
//   formacion, planeacion.

import { createClient } from "@supabase/supabase-js";

const PASSWORD = process.env.QA_PASSWORD ?? "servir-qa-local";
const PRUEBAS = "https://hhjikugnxvffkwcnqijl.supabase.co";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url) && url !== PRUEBAS) throw new Error(`${url} no es la base local ni la de pruebas`);
const db = createClient(url, key, { auth: { persistSession: false } });

function ok<T>(r: { data: T; error: { message: string } | null }, que: string): NonNullable<T> {
  if (r.error) throw new Error(`${que}: ${r.error.message}`);
  return r.data as NonNullable<T>;
}

type Checklist = [("antes" | "durante" | "despues"), string][];

// ── Departamentos, roles y checklists ───────────────────────────────────
const DEPTOS: { nombre: string; slug: string; roles: [string, Checklist][]; gente: [string, string, string] }[] = [
  {
    nombre: "LMRSG", slug: "lmrsg",
    roles: [
      ["Director musical", [["antes", "Enviar repertorio y tonos a la banda"], ["antes", "Dirigir el ensayo"], ["durante", "Marcar entradas y finales"], ["despues", "Reportar novedades del equipo"]]],
      ["Bajo", [["antes", "Afinar y revisar cables"], ["antes", "Repasar el repertorio"], ["despues", "Guardar el instrumento"]]],
      ["Teclado", [["antes", "Cargar los sonidos de cada canción"], ["durante", "Ambientar la oración"], ["despues", "Apagar y cubrir el teclado"]]],
    ],
    gente: ["Marcela Ríos", "Julián Ortega", "Sofía Cárdenas"],
  },
  {
    nombre: "Protocolo", slug: "protocolo",
    roles: [
      ["Ujier puerta 2", [["antes", "Llegar 45 minutos antes"], ["durante", "Ubicar a las personas en sillas libres"], ["despues", "Revisar objetos perdidos"]]],
      ["Bienvenida", [["antes", "Recoger los volantes de bienvenida"], ["durante", "Saludar en la entrada principal"], ["despues", "Entregar datos de nuevos a Comunidad"]]],
      ["Ofrendas", [["antes", "Contar y preparar los sobres"], ["durante", "Recoger la ofrenda por filas"], ["despues", "Entregar la ofrenda con acta"]]],
    ],
    gente: ["Ricardo Peña", "Natalia Duarte", "Felipe Arango"],
  },
  {
    nombre: "Creativos", slug: "creativos",
    roles: [
      ["Proyección", [["antes", "Cargar letras y anuncios"], ["antes", "Probar el orden con el director"], ["durante", "Seguir la letra en tiempo real"], ["despues", "Guardar la presentación"]]],
      ["Cámara", [["antes", "Cargar baterías y tarjetas"], ["durante", "Seguir al predicador"], ["despues", "Descargar el material"]]],
      ["Redes en vivo", [["antes", "Preparar el texto de la transmisión"], ["durante", "Publicar historias"], ["despues", "Subir el resumen"]]],
    ],
    gente: ["Camila Restrepo", "Daniel Mejía", "Laura Salazar"],
  },
  {
    nombre: "Roadies", slug: "roadies",
    roles: [
      ["Sonido", [["antes", "Prueba de sonido con la banda"], ["antes", "Revisar micrófonos inalámbricos"], ["durante", "Mezcla en vivo"], ["despues", "Apagar la consola en orden"]]],
      ["Luces", [["antes", "Cargar la escena de la reunión"], ["durante", "Cambiar escenas en cada momento"], ["despues", "Apagar equipos"]]],
      ["Montaje", [["antes", "Armar tarima y atriles"], ["despues", "Desmontar y guardar"]]],
    ],
    gente: ["Esteban Gil", "Mateo Londoño", "Andrea Vélez"],
  },
  {
    nombre: "Semillas", slug: "semillas",
    roles: [
      ["Maestro de niños", [["antes", "Preparar la clase y el material"], ["durante", "Dar la clase"], ["despues", "Entregar a cada niño a su acudiente"]]],
      ["Auxiliar de niños", [["antes", "Organizar el salón"], ["durante", "Acompañar las actividades"], ["despues", "Dejar el salón limpio"]]],
      ["Registro de niños", [["antes", "Imprimir las fichas"], ["durante", "Registrar entradas con acudiente"], ["despues", "Verificar que no quede ningún niño"]]],
    ],
    gente: ["Paola Herrera", "Juan Pablo Ruiz", "Mariana Torres"],
  },
  {
    nombre: "Vida en Comunidad", slug: "comunidad",
    roles: [
      ["Café", [["antes", "Preparar café y vasos"], ["durante", "Atender la estación"], ["despues", "Lavar y guardar"]]],
      ["Consolidación", [["antes", "Revisar la lista de nuevos"], ["durante", "Acompañar a los nuevos"], ["despues", "Registrar los contactos"]]],
    ],
    gente: ["Gloria Méndez", "Óscar Patiño", "Valentina Rojas"],
  },
  {
    nombre: "Casa de Formación", slug: "formacion",
    roles: [
      ["Facilitador", [["antes", "Preparar la lección"], ["durante", "Guiar la conversación"], ["despues", "Enviar la tarea al grupo"]]],
      ["Asistencia", [["antes", "Imprimir la lista"], ["durante", "Tomar asistencia"], ["despues", "Subir la asistencia"]]],
    ],
    gente: ["Héctor Castaño", "Diana Quintero", "Sebastián Lara"],
  },
  {
    nombre: "Planeación", slug: "planeacion",
    roles: [
      ["Coordinador de reunión", [["antes", "Confirmar el orden con el pastor"], ["antes", "Verificar que todos los roles estén cubiertos"], ["durante", "Controlar los tiempos"], ["despues", "Revisar el reporte"]]],
      ["Tiempos", [["durante", "Avisar al predicador los últimos 5 minutos"], ["despues", "Anotar novedades"]]],
    ],
    gente: ["Carolina Zapata", "Miguel Ángel Rincón", "Isabel Franco"],
  },
];

const GENERALES: [string, Checklist][] = [
  ["VIO", [["antes", "Dirigir la reunión de servidores 1 hora antes"], ["antes", "Orar con los equipos"], ["durante", "Atender imprevistos"], ["despues", "Despedir a los servidores"]]],
  ["Escenario", [["antes", "Revisar el orden con el coordinador"], ["durante", "Dar paso a cada momento en tarima"], ["despues", "Entregar la tarima a Roadies"]]],
  ["Predicador", [["antes", "Enviar el texto bíblico a Creativos"], ["antes", "Confirmar el tiempo de la prédica con Planeación"], ["despues", "Orar por quienes pasen al frente"]]],
];

const CANCIONES: [string, string, number][] = [
  ["Prueba · Amanecer de gracia", "G", 72], ["Prueba · Fuego en el altar", "A", 128], ["Prueba · Tu nombre es refugio", "D", 68],
  ["Prueba · Ciudad en lo alto", "E", 120], ["Prueba · Río de paz", "C", 76], ["Prueba · Canto nuevo", "B", 132],
  ["Prueba · Fiel en la tormenta", "F", 70], ["Prueba · Corazón rendido", "G", 64], ["Prueba · Celebramos", "D", 140],
  ["Prueba · Eterno amor", "Bb", 74], ["Prueba · Abre los cielos", "A", 118], ["Prueba · Hogar", "E", 66],
];

// ── Ayudantes ───────────────────────────────────────────────────────────
async function idPor(tabla: string, campo: string, valor: string): Promise<string> {
  return ok(await db.from(tabla).select("id").eq(campo, valor).single(), `${tabla} ${valor}`).id;
}

async function rolDepto(ministryId: string | null, nombre: string, sort: number, checklist: Checklist): Promise<string> {
  let q = db.from("positions").select("id").eq("name", nombre);
  q = ministryId ? q.eq("ministry_id", ministryId) : q.is("ministry_id", null);
  let id = ok(await q, nombre)[0]?.id as string | undefined;
  if (!id) id = ok(await db.from("positions").insert({ ministry_id: ministryId, name: nombre, sort }).select("id").single(), nombre).id;
  const { count } = await db.from("checklist_templates").select("id", { count: "exact", head: true }).eq("position_id", id);
  if (!count) ok(await db.from("checklist_templates").insert(checklist.map(([moment, text], i) => ({ position_id: id, moment, text, sort: i }))), `checklist ${nombre}`);
  return id!;
}

async function persona(nombre: string): Promise<string> {
  const r = ok(await db.from("people").select("id").eq("full_name", nombre).limit(1), nombre);
  return r[0]?.id ?? ok(await db.from("people").insert({ full_name: nombre }).select("id").single(), nombre).id;
}

async function miembro(personId: string, ministryId: string, posiciones: string[]) {
  if (!ok(await db.from("team_members").select("id").eq("person_id", personId).eq("ministry_id", ministryId).is("area_id", null), "miembro").length) {
    ok(await db.from("team_members").insert({ person_id: personId, ministry_id: ministryId }), "miembro");
  }
  ok(await db.from("person_positions").upsert(posiciones.map((position_id) => ({ person_id: personId, position_id })), { ignoreDuplicates: true }), "person_positions");
}

let usuarios: { id: string; email?: string }[] | null = null;
async function usuario(email: string, nombre: string, rolPrincipal: string, personId: string): Promise<string> {
  if (!usuarios) {
    const r = await db.auth.admin.listUsers({ perPage: 1000 });
    if (r.error) throw new Error(`usuarios: ${r.error.message}`);
    usuarios = r.data.users;
  }
  let id = usuarios.find((u) => u.email === email)?.id;
  if (!id) {
    const r = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: nombre } });
    if (r.error) throw new Error(`usuario ${email}: ${r.error.message}`);
    id = r.data.user.id;
  }
  ok(await db.from("profiles").update({ full_name: nombre, role: rolPrincipal, requested_role: null }).eq("id", id), "perfil");
  ok(await db.from("people").update({ profile_id: id }).eq("id", personId), "people.profile_id");
  return id;
}

async function rol(userId: string, role: string, ministryId: string) {
  if (!ok(await db.from("user_roles").select("id").eq("user_id", userId).eq("role", role).eq("ministry_id", ministryId), "rol").length) {
    ok(await db.from("user_roles").insert({ user_id: userId, role, ministry_id: ministryId }), "rol");
  }
}

// Fecha YYYY-MM-DD de hoy + n días en Bogotá, y su día de la semana.
function dia(n: number): { fecha: string; semana: number } {
  const d = new Date(Date.now() - 5 * 3600_000 + n * 86400_000);
  return { fecha: d.toISOString().slice(0, 10), semana: d.getUTCDay() };
}
const enBogota = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`).toISOString();

// ── Principal ───────────────────────────────────────────────────────────
async function main() {
  const planeacionUser = ok(await db.from("profiles").select("id").eq("role", "planeacion").limit(1), "planeación")[0]?.id;
  if (!planeacionUser) throw new Error("Corre primero scripts/semilla-qa-etapa5.ts");

  // Roles por departamento y personas con cuenta.
  const rolesDe = new Map<string, string[]>();        // slug → ids de roles
  const genteDe = new Map<string, string[]>();        // slug → ids de personas
  const deptoId = new Map<string, string>();
  for (const d of DEPTOS) {
    const mid = await idPor("ministries", "name", d.nombre);
    deptoId.set(d.slug, mid);
    const roles: string[] = [];
    for (const [i, [nombre, cl]] of d.roles.entries()) roles.push(await rolDepto(mid, nombre, 10 + i, cl));
    rolesDe.set(d.slug, roles);

    const ids: string[] = [];
    for (const [i, nombre] of d.gente.entries()) {
      const pid = await persona(nombre);
      await miembro(pid, mid, roles);
      const esLider = i === 0;
      const email = `${d.slug}.${esLider ? "lider" : i}@rsg.test`;
      const uid = await usuario(email, nombre, esLider ? (d.slug === "planeacion" ? "planeacion" : "leader") : "servidor", pid);
      if (esLider) await rol(uid, "lider_departamento", mid);
      ids.push(pid);
    }
    genteDe.set(d.slug, ids);
  }

  // Los roles de LMRSG y Protocolo que ya traía la semilla QA, con su gente.
  const lmrsg = deptoId.get("lmrsg")!, protocolo = deptoId.get("protocolo")!;
  const rolExistente = async (mid: string, nombre: string) =>
    ok(await db.from("positions").select("id").eq("ministry_id", mid).eq("name", nombre).single(), nombre).id as string;
  const director = await rolExistente(lmrsg, "Director musical");
  const musica = await Promise.all(["Guitarra eléctrica", "Batería", "Voz principal", "Coros"].map((n) => rolExistente(lmrsg, n)));
  const puerta1 = await rolExistente(protocolo, "Ujier puerta 1");
  const qa = async (n: string) => persona(n);
  const pSamuel = await qa("QA Samuel Servidor"), pTomas = await qa("QA Tomás Batería"), pValeria = await qa("QA Valeria Voz"),
        pCarla = await qa("QA Carla Coros"), pLaura = await qa("QA Laura Líder LMRSG"), pPaula = await qa("QA Paula Servidora Protocolo");

  // El pastor de sede predica (su ficha la crea la base, ver 20261029160000_servir_pastores.sql).
  const pastorUser = ok(await db.from("profiles").select("id").eq("role", "pastor_sede").limit(1), "pastor")[0]?.id;
  const pPastor = pastorUser ? ok(await db.from("people").select("id").eq("profile_id", pastorUser).limit(1), "ficha del pastor")[0]?.id as string | undefined : undefined;

  const generales: string[] = [];
  for (const [i, [nombre, cl]] of GENERALES.entries()) generales.push(await rolDepto(null, nombre, i, cl));

  // Canciones.
  const canciones: string[] = [];
  for (const [title, default_key, bpm] of CANCIONES) {
    const r = ok(await db.from("songs").select("id").eq("title", title).limit(1), title);
    canciones.push(r[0]?.id ?? ok(await db.from("songs").insert({ title, artist: "RSG pruebas", default_key, bpm, tags: ["prueba"] }).select("id").single(), title).id);
  }

  // Borrar lo que se creó antes: despublicar libera las reservas.
  const viejas = ok(await db.from("meetings").select("id").like("legacy_id", "prueba-%"), "reuniones viejas");
  if (viejas.length) {
    const ids = viejas.map((m) => m.id);
    ok(await db.from("meetings").update({ status: "borrador" }).in("id", ids), "despublicar");
    ok(await db.from("bookings").delete().in("meeting_id", ids), "reservas viejas");
    ok(await db.from("meetings").delete().in("id", ids), "borrar viejas");
  }

  const espacio = async (n: string) => idPor("spaces", "name", n);
  const auditorio = await espacio("Auditorio"), lobby = await espacio("Lobby"), salon38 = await espacio("Salón 38");
  const tipo = async (n: string) => idPor("meeting_types", "name", n);

  // Plan: domingo Reunión Central, miércoles Jóvenes, jueves Estudio Bíblico.
  const PLAN: Record<number, { tipo: string; hora: string; min: number; espacios: string[]; kind: "central" | "jovenes" | "estudio" }> = {
    0: { tipo: "Reunión Central", hora: "10:00", min: 120, espacios: [auditorio, lobby], kind: "central" },
    3: { tipo: "Jóvenes · Reunión semanal", hora: "19:00", min: 120, espacios: [auditorio], kind: "jovenes" },
    4: { tipo: "Estudio Bíblico", hora: "19:00", min: 90, espacios: [salon38], kind: "estudio" },
  };

  const persona_rol = (slug: string, k: number) => genteDe.get(slug)![k % 3];
  let nCancion = 0, total = 0;
  const reuniones: string[] = [];

  for (let n = 0; n < 14; n++) {
    const { fecha, semana } = dia(n);
    const p = PLAN[semana];
    if (!p) continue;
    const ultima = n >= 12;   // la última queda en borrador para probar publicar
    const inicio = enBogota(fecha, p.hora);
    const fin = new Date(new Date(inicio).getTime() + p.min * 60_000).toISOString();
    const m = ok(await db.from("meetings").insert({
      legacy_id: `prueba-${fecha}-${p.kind}`, name: p.tipo, meeting_date: fecha, starts_at: inicio, ends_at: fin,
      meeting_type_id: await tipo(p.tipo), kind: "ministerio", status: "borrador", origin: "manual",
      created_by: planeacionUser, notes: "Reunión de prueba",
    }).select("id").single(), `reunión ${fecha}`);
    reuniones.push(`${fecha} ${p.hora} ${p.tipo}${ultima ? " (borrador)" : ""}`);

    // Orden de la reunión.
    const orden: { kind: string; title: string; min: number; song?: boolean; resp?: string }[] =
      p.kind === "estudio"
        ? [{ kind: "oracion", title: "Oración de apertura", min: 5 }, { kind: "cancion", title: "", min: 5, song: true, resp: director },
           { kind: "predica", title: "Estudio: Romanos 8", min: 60 }, { kind: "oracion", title: "Oración final", min: 10 }]
        : [{ kind: "encabezado", title: "Bienvenida", min: 3 }, { kind: "cancion", title: "", min: 5, song: true, resp: director },
           { kind: "cancion", title: "", min: 5, song: true, resp: director }, { kind: "cancion", title: "", min: 6, song: true, resp: director },
           { kind: "oracion", title: "Oración", min: 4 }, { kind: "anuncio", title: "Anuncios", min: 5 },
           ...(p.kind === "central" ? [{ kind: "otro", title: "Ofrenda", min: 5, resp: puerta1 }] : []),
           { kind: "predica", title: p.kind === "central" ? "Prédica" : "Mensaje para jóvenes", min: p.kind === "central" ? 40 : 35 },
           { kind: "cancion", title: "", min: 5, song: true, resp: director }, { kind: "oracion", title: "Oración final", min: 3 }];
    ok(await db.from("run_items").insert(orden.map((o, i) => {
      const c = o.song ? CANCIONES[nCancion % CANCIONES.length] : null, sid = o.song ? canciones[nCancion++ % canciones.length] : null;
      return { meeting_id: m.id, sort: i, kind: o.kind, title: c ? c[0].replace("Prueba · ", "") : o.title, duration_sec: o.min * 60,
               song_id: sid, song_key: c?.[1] ?? null, responsible_position_id: o.resp ?? null };
    })), "orden");

    // Asignaciones: [persona, rol].
    const k = n;   // rota quién sirve
    const asig: [string, string][] = [
      [pLaura, director], [pSamuel, musica[0]], [pTomas, musica[1]], [pValeria, musica[2]], [pCarla, musica[3]],
      [persona_rol("lmrsg", k + 1), rolesDe.get("lmrsg")![1]], [persona_rol("lmrsg", k + 2), rolesDe.get("lmrsg")![2]],
      [pPaula, puerta1], [persona_rol("protocolo", k), rolesDe.get("protocolo")![0]], [persona_rol("protocolo", k + 1), rolesDe.get("protocolo")![1]],
      [persona_rol("creativos", k), rolesDe.get("creativos")![0]], [persona_rol("creativos", k + 1), rolesDe.get("creativos")![1]],
      [persona_rol("roadies", k), rolesDe.get("roadies")![0]], [persona_rol("roadies", k + 1), rolesDe.get("roadies")![1]],
      [persona_rol("comunidad", k), rolesDe.get("comunidad")![0]],
      [persona_rol("planeacion", k), rolesDe.get("planeacion")![0]],
      [persona_rol("comunidad", k + 1), generales[0]],     // VIO: cualquier servidor
      [persona_rol("roadies", k + 2), generales[1]],       // Escenario
      ...(pPastor && p.kind !== "estudio" ? [[pPastor, generales[2]] as [string, string]] : []),   // Predicador
    ];
    if (p.kind === "central") {
      asig.push([persona_rol("protocolo", k + 2), rolesDe.get("protocolo")![2]],
                [persona_rol("semillas", k), rolesDe.get("semillas")![0]], [persona_rol("semillas", k + 1), rolesDe.get("semillas")![1]],
                [persona_rol("creativos", k + 2), rolesDe.get("creativos")![2]]);
    }
    if (p.kind === "estudio") {
      asig.splice(1, 6);   // sin banda completa: director + voz
      asig.push([pValeria, musica[2]], [persona_rol("formacion", k), rolesDe.get("formacion")![0]], [persona_rol("formacion", k + 1), rolesDe.get("formacion")![1]]);
    }

    const posMinisterio = new Map<string, string | null>();
    for (const [, pos] of asig) if (!posMinisterio.has(pos)) posMinisterio.set(pos, ok(await db.from("positions").select("ministry_id").eq("id", pos).single(), "rol").ministry_id);

    const vistos = new Set<string>();
    for (const [i, [person_id, position_id]] of asig.entries()) {
      if (vistos.has(`${person_id}${position_id}`)) continue;
      vistos.add(`${person_id}${position_id}`);
      // Casi todas aceptadas (con checklist); algunas pendientes y una rechazada.
      const estado = ultima ? "pendiente" : person_id === pPastor ? "aceptada" : i % 7 === 3 ? "pendiente" : i % 11 === 5 ? "rechazada" : "aceptada";
      const a = ok(await db.from("assignments").insert({
        meeting_id: m.id, person_id, position_id, ministry_id: posMinisterio.get(position_id),
        status: estado === "aceptada" ? "aceptada" : "pendiente", assigned_by: planeacionUser,
        responded_at: estado === "aceptada" ? new Date().toISOString() : null,
      }).select("id").single(), "asignación");
      if (estado === "rechazada") {
        ok(await db.from("assignments").update({ status: "rechazada", responded_at: new Date().toISOString(), decline_reason: "Estoy de viaje ese día" }).eq("id", a.id), "rechazo");
      }
      total++;
    }

    // Espacios y publicación (la base crea las reservas con montaje y desmonte).
    ok(await db.from("meeting_spaces").insert(p.espacios.map((space_id) => ({ meeting_id: m.id, space_id }))), "espacios");
    if (!ultima) ok(await db.from("meetings").update({ status: "publicada" }).eq("id", m.id), `publicar ${fecha}`);
  }

  // Los avisos que generó la semilla quedan en la bandeja, sin mandar push.
  ok(await db.from("notifications").update({ pushed_at: new Date().toISOString() }).is("pushed_at", null), "avisos");

  console.log(`✓ Ambiente de pruebas listo: ${reuniones.length} reuniones, ${total} asignaciones, ${canciones.length} canciones`);
  for (const r of reuniones) console.log(`  ${r}`);
}

main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });

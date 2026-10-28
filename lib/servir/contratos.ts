// Contratos del módulo Servir (Etapa 5, Fase A).
//
// Cada frente de la Fase B/C programa contra estas firmas. Las filas salen de
// los tipos generados (lib/database.types.ts); aquí solo van los nombres
// cortos, los valores de dominio y las firmas de las server actions que cada
// frente implementa en sus carpetas. Cambiar algo de este archivo es cambiar
// el contrato: se avisa a los demás frentes (plan, sección 7).
//
// Toda acción valida en el servidor y deja que RLS decida qué filas se ven o
// cambian; ninguna acción usa service_role salvo las marcadas.

import type { Database } from "@/lib/database.types";

type Tablas = Database["public"]["Tables"];
type Fila<T extends keyof Tablas> = Tablas[T]["Row"];

// ── Filas ────────────────────────────────────────────────────────────────
export type Persona = Fila<"people">;
export type GrupoDiscipulado = Fila<"discipleship_groups">;
export type Area = Fila<"areas">;
export type MiembroEquipo = Fila<"team_members">;
export type Posicion = Fila<"positions">;
export type BloqueoDisponibilidad = Fila<"availability_blocks">;
export type TipoReunion = Fila<"meeting_types">;
export type PlantillaReunion = Fila<"meeting_templates">;
export type Reunion = Fila<"meetings">;
export type CambioReunion = Fila<"meeting_changes">;
export type Cancion = Fila<"songs">;
export type ItemOrden = Fila<"run_items">;
export type Asignacion = Fila<"assignments">;
export type PlantillaChecklist = Fila<"checklist_templates">;
export type ItemChecklist = Fila<"checklist_items">;
export type Asistencia = Fila<"attendance">;
export type SuscripcionPush = Fila<"push_subscriptions">;
export type Envio = Fila<"broadcasts">;
export type Notificacion = Fila<"notifications">;
export type UnidadServicio = Database["public"]["Views"]["service_units"]["Row"];

// ── Valores de dominio (iguales a los check de la base) ─────────────────
export type EstadoReunion = "borrador" | "publicada" | "en_vivo" | "cerrada" | "cancelada";
export type ClaseReunion = "ministerio" | "servolucion" | "evento";
export type Conteo = "min" | "serv";
export type EstadoAsignacion = "pendiente" | "aceptada" | "rechazada" | "cancelada";
export type MomentoChecklist = "antes" | "durante" | "despues";
export type TipoItemOrden = "cancion" | "predica" | "oracion" | "anuncio" | "encabezado" | "otro";
export type EstadoAsistencia = "asistio" | "tarde" | "ausente";
export type Audiencia = "todos" | "departamento" | "area" | "reunion";
export type Plataforma = "web" | "android" | "ios";

export type Permiso =
  | "servir.ver_todo" | "servir.ver_reuniones" | "servir.planear" | "servir.vivo"
  | "servir.asistencia" | "servir.asignar" | "servir.plantillas" | "servir.estadisticas"
  | "canciones.editar" | "notificar.enviar";

// Las acciones devuelven esto en vez de lanzar: la UI muestra `error` tal cual.
export type Resultado<T = void> = { ok: true; data: T } | { ok: false; error: string };

// Forma del orden de una plantilla (meeting_templates.run_sheet).
export type ItemOrdenPlantilla = {
  kind: TipoItemOrden;
  title: string;
  duration_sec: number | null;
  song_id?: string | null;
  responsible_position_id?: string | null;
};
// meeting_templates.required_positions
export type PosicionRequerida = { position_id: string; count: number };

// ── B1 · Planeación (app/servir/reuniones, app/servir/plantillas) ────────
export type NuevaReunion = {
  meeting_type_id: string | null;
  template_id?: string | null;
  name: string;
  meeting_date: string;          // YYYY-MM-DD (Bogotá)
  starts_at?: string | null;     // ISO UTC
  ends_at?: string | null;
  ministry_id?: string | null;
  booking_id?: string | null;
};
export type AccionesPlaneacion = {
  crearReunion(input: NuevaReunion): Promise<Resultado<{ id: string }>>;
  // Crea una reunión por fecha con el mismo tipo/plantilla (fechas YYYY-MM-DD).
  crearEnSerie(input: Omit<NuevaReunion, "meeting_date">, fechas: string[]): Promise<Resultado<{ ids: string[] }>>;
  duplicarReunion(id: string, meeting_date: string): Promise<Resultado<{ id: string }>>;
  guardarComoPlantilla(meetingId: string, nombre: string): Promise<Resultado<{ id: string }>>;
  guardarOrden(meetingId: string, items: (ItemOrdenPlantilla & { id?: string; sort: number })[]): Promise<Resultado>;
  publicarReunion(id: string): Promise<Resultado>;
  // Registra meeting_changes y avisa a los asignados.
  reprogramarReunion(id: string, nueva_fecha: string, starts_at?: string | null, motivo?: string): Promise<Resultado>;
  cancelarReunion(id: string, motivo?: string): Promise<Resultado>;
};

// ── B2 · Canciones (app/servir/canciones) ────────────────────────────────
export type AccionesCanciones = {
  guardarCancion(input: Partial<Cancion> & { title: string }): Promise<Resultado<{ id: string }>>;
  // Sube al bucket privado 'songs' en songs/{id}/{archivo}; agrega a songs.files.
  subirArchivoCancion(songId: string, archivo: FormData): Promise<Resultado<{ path: string }>>;
  borrarCancion(id: string): Promise<Resultado>;
};

// ── B3 · Equipos y asignaciones (app/servir/equipo, app/servir/mis-servicios)
export type SugerenciaAsignacion = {
  person_id: string;
  full_name: string;
  servicios_mes: number;         // de service_units
  bloqueado: boolean;            // availability_blocks en esa fecha
  ya_asignado: boolean;          // otra posición en la misma reunión
};
export type AccionesEquipo = {
  sugerirServidores(meetingId: string, positionId: string): Promise<Resultado<SugerenciaAsignacion[]>>;
  asignar(meetingId: string, personId: string, positionId: string): Promise<Resultado<{ id: string }>>;
  cancelarAsignacion(id: string): Promise<Resultado>;
  // Envuelven las RPC respond_assignment / toggle_checklist_item.
  responderAsignacion(id: string, aceptar: boolean, motivo?: string): Promise<Resultado>;
  marcarChecklist(itemId: string, hecho: boolean): Promise<Resultado>;
  guardarBloqueo(input: { starts_on: string; ends_on: string; reason?: string }): Promise<Resultado<{ id: string }>>;
};

// ── B4 · Notificaciones (lib/notificaciones, supabase/functions/notificador)
export type AccionesNotificaciones = {
  registrarDispositivo(
    input: { platform: "web"; endpoint: string; p256dh: string; auth: string; device?: string }
         | { platform: "android" | "ios"; token: string; device?: string; app_version?: string },
  ): Promise<Resultado>;
  // RLS de broadcasts decide si el autor puede usar esa audiencia.
  enviarMasivo(input: { audience: Audiencia; scope_id: string | null; title: string; body: string; link?: string; scheduled_for?: string }): Promise<Resultado<{ id: string }>>;
  marcarLeidas(ids: string[] | "todas"): Promise<Resultado>;
};

// ── B5 · Cuentas (app/(auth), app/perfil/cuenta, lib/cuentas) ────────────
export type AccionesCuentas = {
  // Une la cuenta que inició sesión con la persona de la invitación (people.profile_id).
  aceptarInvitacion(token: string): Promise<Resultado<{ person_id: string }>>;
  invitarPersona(personId: string, email: string): Promise<Resultado>;
  // Revoca el token de Apple si la cuenta lo usa (App Store 5.1.1(v)). service_role.
  eliminarMiCuenta(): Promise<Resultado>;
};

// ── C1 · En vivo y asistencia (app/servir/[id]/vivo) ─────────────────────
export type AccionesVivo = {
  iniciarReunion(id: string): Promise<Resultado>;
  avanzarItem(meetingId: string, itemId: string | null): Promise<Resultado>;
  terminarReunion(id: string): Promise<Resultado>;
  // Una fila por persona: varios roles en la misma reunión = un servicio.
  // Planeación confirma a todos y puede cerrar (opciones.cerrar); el líder de
  // departamento confirma a su gente mientras no esté cerrada (decisión de Gian).
  confirmarAsistencia(
    meetingId: string,
    filas: { person_id: string; status: EstadoAsistencia; roles: string[]; note?: string }[],
    opciones?: { cerrar?: boolean },
  ): Promise<Resultado>;
};

// ── C3 · Estadísticas (app/servir/estadisticas) ──────────────────────────
export type Semaforo = "sano" | "sobrecargado" | "alejandose" | "inactivo";
// Una fila de salud_servidores(): la ventana (30 días por defecto) y los
// umbrales salen de servir_ajustes.
export type SaludServidor = Database["public"]["Functions"]["salud_servidores"]["Returns"][number] & { semaforo: Semaforo };
export type EstadisticaReunion = Database["public"]["Functions"]["estadisticas_reuniones"]["Returns"][number];
export type AjustesSalud = Fila<"servir_ajustes">;

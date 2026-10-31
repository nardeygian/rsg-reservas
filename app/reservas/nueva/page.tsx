import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  nextHourBogota,
  toDateParam,
  toDatetimeLocalBogota,
} from "@/lib/datetime";
import { getBogotaWeekday } from "@/lib/recurrence";
import { createBookingAction } from "./actions";
import { RecurrenceFields } from "./_components/RecurrenceFields";
import { addMonths } from "date-fns";

const USE_TYPE_OPTIONS = [
  { value: "reunion_departamento", label: "Reunión de departamento" },
  { value: "reunion_ministerio", label: "Reunión de ministerio" },
  { value: "consejeria", label: "Consejería" },
  { value: "discipulado", label: "Reunión de discipulado" },
  { value: "evento", label: "Evento" },
  { value: "externo", label: "Externo" },
  { value: "studio_negocio", label: "Studio (negocio)" },
  { value: "otro", label: "Otro" },
];

const POLICY_LABELS: Record<string, string> = {
  self_serve: "Reserva directa",
  needs_approval: "Requiere aprobación",
};

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; space?: string; date?: string }>;
}) {
  const { error, space: prefilledSpace, date: datePrefill } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
    : { data: null };

  // Un servidor no reserva espacios: la política de inserción de bookings no lo deja.
  if (profile?.role === "servidor") redirect("/");

  const isStudioAdmin = profile?.role === "studio_admin";

  let spacesQuery = supabase
    .from("spaces")
    .select("id, name, booking_policy, status")
    .neq("status", "disabled");

  if (isStudioAdmin) {
    spacesQuery = spacesQuery.eq("slug", "estudio");
  }

  const { data: spaces } = await spacesQuery.order("name");
  const studioSpaceId = isStudioAdmin ? spaces?.[0]?.id ?? "" : "";

  const startDefault =
    datePrefill && /^\d{4}-\d{2}-\d{2}$/.test(datePrefill)
      ? (() => {
          const d = new Date(`${datePrefill}T08:00:00`);
          // Shift to Bogotá 8am (UTC-5)
          d.setUTCHours(13, 0, 0, 0);
          return d;
        })()
      : nextHourBogota();
  const endDefault = new Date(startDefault.getTime() + 60 * 60 * 1000);

  const { data: itemsAvail } = await supabase.rpc("items_available", {
    _starts: startDefault.toISOString(),
    _ends: endDefault.toISOString(),
  });
  const recurrenceUntilDefault = toDateParam(addMonths(startDefault, 3));

  return (
    <main className="min-h-dvh px-4 pt-6 pb-8 max-w-md md:max-w-[1180px] md:px-[clamp(12px,3vw,40px)] mx-auto flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="page-title">Nueva reserva</h1>
          <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>
            Elige el espacio y el horario. Si el espacio requiere aprobación, te avisamos cuando la revisen.
          </p>
        </div>
        <Link href="/reservas" prefetch className="h-9 px-4 rounded-full text-[14px] font-semibold inline-flex items-center flex-none"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", color: "var(--color-ink)", boxShadow: "inset 0 1px 0 var(--glass-border)" }}>
          Cancelar
        </Link>
      </header>

      <form action={createBookingAction} className="grid gap-5 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] md:items-start">
        {/* ── Columna principal ── */}
        <div className="card p-5 md:p-7 flex flex-col gap-5">
        <h2 className="text-[13px] font-semibold" style={{ color: "var(--color-muted)" }}>Dónde y cuándo</h2>
        <div>
          <label htmlFor="space_id" className="field-label block mb-1.5">
            Espacio
          </label>
          <select
            id="space_id"
            name="space_id"
            required
            defaultValue={isStudioAdmin ? studioSpaceId : (prefilledSpace ?? "")}
            disabled={isStudioAdmin}
            className="input"
          >
            {!isStudioAdmin && (
              <option value="" disabled>
                Elige un espacio
              </option>
            )}
            {(spaces ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {POLICY_LABELS[s.booking_policy] ?? s.booking_policy}
              </option>
            ))}
          </select>
          {isStudioAdmin && (
            <>
              <input type="hidden" name="space_id" value={studioSpaceId} />
              <p className="text-xs mt-1" style={{ color: "var(--color-faint)" }}>
                Como Admin del Estudio, solo puedes crear reservas para el Estudio.
              </p>
            </>
          )}
        </div>

        {isStudioAdmin && (
          <label className="card flex items-start gap-3 cursor-pointer px-4 py-3">
            <input
              type="checkbox"
              name="external_client"
              defaultChecked
              className="mt-1 accent-[var(--color-accent)]"
            />
            <span className="block">
              <span className="font-medium block">Cliente externo</span>
              <span className="text-xs mt-0.5 block" style={{ color: "var(--color-faint)" }}>
                Marca esta opción si la reserva NO pertenece a la iglesia.
                Los demás solo verán &ldquo;Reserva externa&rdquo; con la franja ocupada.
              </span>
            </span>
          </label>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-3">
          <div>
            <label htmlFor="starts_at" className="field-label block mb-1.5">
              Inicio
            </label>
            <input
              id="starts_at"
              name="starts_at"
              type="datetime-local"
              required
              defaultValue={toDatetimeLocalBogota(startDefault)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="ends_at" className="field-label block mb-1.5">
              Fin
            </label>
            <input
              id="ends_at"
              name="ends_at"
              type="datetime-local"
              required
              defaultValue={toDatetimeLocalBogota(endDefault)}
              className="input"
            />
          </div>
        </div>

        <h2 className="text-[13px] font-semibold pt-3 border-t" style={{ color: "var(--color-muted)" }}>Detalles</h2>
        <div>
          <label htmlFor="use_type" className="field-label block mb-1.5">
            Tipo de uso
          </label>
          <select
            id="use_type"
            name="use_type"
            required
            defaultValue=""
            className="input"
          >
            <option value="" disabled>
              Elige el tipo
            </option>
            {USE_TYPE_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="title" className="field-label block mb-1.5">
            Título{" "}
            <span style={{ color: "var(--color-faint)" }}>(opcional)</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            maxLength={120}
            placeholder="Ej. Reunión de líderes"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="expected_attendance" className="field-label block mb-1.5">
            Asistencia esperada{" "}
            <span style={{ color: "var(--color-faint)" }}>(opcional)</span>
          </label>
          <input
            id="expected_attendance"
            name="expected_attendance"
            type="number"
            min={1}
            max={5000}
            className="input"
          />
        </div>

        <RecurrenceFields
          defaultUntil={recurrenceUntilDefault}
          defaultByday={getBogotaWeekday(startDefault)}
        />
        </div>

        {/* ── Columna lateral: lo que hay que montar y confirmar ── */}
        <div className="flex flex-col gap-4 md:sticky md:top-6">
        {(itemsAvail ?? []).length > 0 && (
          <fieldset className="card p-5 flex flex-col gap-3">
            <legend className="sr-only">¿Necesitas algo más?</legend>
            <div className="flex flex-col gap-1">
              <h2 className="text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>¿Necesitas algo más?</h2>
              <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>
                Sin costo para reservas internas. Indícalo para que el equipo lo deje listo.
                Revisamos que haya suficientes al guardar.
              </p>
              <p className="text-[12px]" style={{ color: "var(--color-faint)" }}>
                Si la reserva se repite, pide estos elementos aparte para cada fecha.
              </p>
            </div>
            <ul className="space-y-2">
              {(itemsAvail ?? []).map((it) => (
                <li
                  key={it.item_id}
                  className="flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5"
                  style={{ background: "var(--color-surface-2)" }}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{it.name}</p>
                    <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                      {it.available} disponibles
                    </p>
                  </div>
                  <input
                    type="number"
                    name={`item_qty_${it.item_id}`}
                    min={0}
                    max={it.available}
                    defaultValue={0}
                    className="w-20 px-2 py-1 text-sm text-right tabular-nums input"
                    aria-label={`Cantidad de ${it.name}`}
                  />
                </li>
              ))}
            </ul>
          </fieldset>
        )}


        {error && (
          <p
            role="alert"
            className="text-sm rounded-[var(--radius-control)] px-4 py-3"
            style={{
              background: "var(--color-down-soft)",
              color: "var(--color-down)",
            }}
          >
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full">
          Crear reserva
        </button>
        <p
          className="text-xs text-center"
          style={{ color: "var(--color-faint)" }}
        >
          Si el espacio requiere aprobación, queda pendiente hasta que un
          pastor o admin la apruebe.
        </p>
        </div>
      </form>
    </main>
  );
}

import Link from "next/link";
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

const MENTOR_USE_TYPES = new Set(["discipulado", "consejeria", "otro"]);

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

  const isStudioAdmin = profile?.role === "studio_admin";
  const isMentor = profile?.role === "mentor";

  const useTypeOptions = isMentor
    ? USE_TYPE_OPTIONS.filter((u) => MENTOR_USE_TYPES.has(u.value))
    : USE_TYPE_OPTIONS;

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
    <main className="min-h-dvh px-4 py-5 max-w-md mx-auto space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <span className="eyebrow">Nueva</span>
          <h1
            className="text-[22px] font-semibold mt-0.5 leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Crear reserva
          </h1>
        </div>
        <Link
          href="/calendario"
          className="text-sm"
          style={{ color: "var(--color-muted)" }}
        >
          Cancelar
        </Link>
      </header>

      <form action={createBookingAction} className="space-y-4">
        <div>
          <label htmlFor="space_id" className="block text-sm mb-1">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="starts_at" className="block text-sm mb-1">
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
            <label htmlFor="ends_at" className="block text-sm mb-1">
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

        <div>
          <label htmlFor="use_type" className="block text-sm mb-1">
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
            {useTypeOptions.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm mb-1">
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
          <label htmlFor="expected_attendance" className="block text-sm mb-1">
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

        {(itemsAvail ?? []).length > 0 && (
          <fieldset
            className="border-t pt-4 space-y-2"
            style={{ borderColor: "var(--color-line)" }}
          >
            <legend className="eyebrow">¿Necesitas algo más?</legend>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              Para reservas internas no hay costo. Solo es para que el equipo
              sepa qué montar. El número es la disponibilidad para la franja
              default; si cambias hora, se revalida al guardar.
            </p>
            <p className="text-xs" style={{ color: "var(--color-gold)" }}>
              Las series recurrentes ignoran items en esta versión.
            </p>
            <ul className="space-y-2">
              {(itemsAvail ?? []).map((it) => (
                <li
                  key={it.item_id}
                  className="flex items-center gap-3 card px-3 py-2"
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

        <RecurrenceFields
          defaultUntil={recurrenceUntilDefault}
          defaultByday={getBogotaWeekday(startDefault)}
        />

        {error && (
          <p
            role="alert"
            className="text-sm rounded-[10px] px-4 py-3"
            style={{
              background: "var(--color-down-soft)",
              color: "var(--color-down)",
            }}
          >
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full">
          Crear
        </button>
        <p
          className="text-xs text-center"
          style={{ color: "var(--color-faint)" }}
        >
          Si el espacio requiere aprobación, queda como pendiente hasta que un
          pastor o admin la apruebe.
        </p>
      </form>
    </main>
  );
}

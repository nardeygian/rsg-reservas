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
  { value: "discipulado", label: "Discipulado" },
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
  searchParams: Promise<{ error?: string; space?: string }>;
}) {
  const { error, space: prefilledSpace } = await searchParams;

  const supabase = await createClient();
  const { data: spaces } = await supabase
    .from("spaces")
    .select("id, name, booking_policy, status")
    .neq("status", "disabled")
    .order("name");

  const startDefault = nextHourBogota();
  const endDefault = new Date(startDefault.getTime() + 60 * 60 * 1000);

  // Disponibilidad de items para la franja default. Si el usuario cambia la
  // hora y sometea, la action vuelve a validar contra la nueva franja —
  // este número es solo una orientación visual al cargar el form.
  const { data: itemsAvail } = await supabase.rpc("items_available", {
    _starts: startDefault.toISOString(),
    _ends: endDefault.toISOString(),
  });
  // Default "hasta" tres meses después del inicio, suficiente para cubrir un
  // semestre ministerial sin abrumar la cantidad de instancias.
  const recurrenceUntilDefault = toDateParam(addMonths(startDefault, 3));

  return (
    <main className="min-h-dvh px-4 py-4 max-w-md mx-auto space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Crear reserva</h1>
        <Link
          href="/calendario"
          className="text-sm underline text-gray-600 dark:text-gray-400"
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
            defaultValue={prefilledSpace ?? ""}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
          >
            <option value="" disabled>
              Elige un espacio
            </option>
            {(spaces ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {POLICY_LABELS[s.booking_policy] ?? s.booking_policy}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
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
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
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
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
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
          <label htmlFor="title" className="block text-sm mb-1">
            Título <span className="text-gray-500">(opcional)</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            maxLength={120}
            placeholder="Ej. Reunión de líderes"
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="expected_attendance" className="block text-sm mb-1">
            Asistencia esperada <span className="text-gray-500">(opcional)</span>
          </label>
          <input
            id="expected_attendance"
            name="expected_attendance"
            type="number"
            min={1}
            max={5000}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
          />
        </div>

        {(itemsAvail ?? []).length > 0 && (
          <fieldset className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-2">
            <legend className="text-sm font-medium">
              ¿Necesitas algo más?
            </legend>
            <p className="text-xs text-gray-500">
              Para reservas internas no hay costo. Solo es para que el equipo
              sepa qué montar. El número entre paréntesis es la disponibilidad
              para la franja default; si cambias hora, se revalida al guardar.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Las series recurrentes ignoran items en esta versión.
            </p>
            <ul className="space-y-2">
              {(itemsAvail ?? []).map((it) => (
                <li
                  key={it.item_id}
                  className="flex items-center gap-3 rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{it.name}</p>
                    <p className="text-xs text-gray-500">
                      {it.available} disponibles
                    </p>
                  </div>
                  <input
                    type="number"
                    name={`item_qty_${it.item_id}`}
                    min={0}
                    max={it.available}
                    defaultValue={0}
                    className="w-20 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm text-right tabular-nums"
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
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-md bg-black text-white py-2 font-medium dark:bg-white dark:text-black"
        >
          Crear
        </button>
        <p className="text-xs text-gray-500 text-center">
          Si el espacio requiere aprobación, queda como pendiente hasta que un
          pastor o admin la apruebe.
        </p>
      </form>
    </main>
  );
}

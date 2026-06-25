import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  nextHourBogota,
  toDateParam,
  toDatetimeLocalBogota,
} from "@/lib/datetime";
import { createBookingAction } from "./actions";
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

        <fieldset className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="recurring"
              value="on"
              className="h-4 w-4"
            />
            <span>Repetir cada semana</span>
          </label>
          <div>
            <label
              htmlFor="recurrence_until"
              className="block text-xs text-gray-500 mb-1"
            >
              Hasta
            </label>
            <input
              id="recurrence_until"
              name="recurrence_until"
              type="date"
              defaultValue={recurrenceUntilDefault}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Solo aplica si marcaste &ldquo;Repetir cada semana&rdquo;. Las
              semanas que choquen con otra reserva se saltan automáticamente.
            </p>
          </div>
        </fieldset>

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

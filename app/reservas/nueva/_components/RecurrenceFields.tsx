"use client";

import { useState } from "react";

type Freq = "daily" | "weekly" | "monthly" | "custom";

// Etiqueta corta para los 7 días. Empezamos en lunes para matchear es-CO.
// El value almacenado coincide con JS Date.getDay() (0=domingo).
const WEEKDAYS: { label: string; value: number }[] = [
  { label: "L", value: 1 },
  { label: "M", value: 2 },
  { label: "X", value: 3 },
  { label: "J", value: 4 },
  { label: "V", value: 5 },
  { label: "S", value: 6 },
  { label: "D", value: 0 },
];

export function RecurrenceFields({
  defaultUntil,
  defaultByday,
}: {
  defaultUntil: string;
  defaultByday: number;
}) {
  const [recurring, setRecurring] = useState(false);
  const [freq, setFreq] = useState<Freq>("weekly");

  return (
    <fieldset className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          name="recurring"
          value="on"
          checked={recurring}
          onChange={(e) => setRecurring(e.target.checked)}
          className="h-4 w-4"
        />
        <span>Repetir esta reserva</span>
      </label>

      {recurring && (
        <div className="space-y-3 pl-6">
          <div>
            <label
              htmlFor="recurrence_freq"
              className="block text-xs text-gray-500 mb-1"
            >
              Frecuencia
            </label>
            <select
              id="recurrence_freq"
              name="recurrence_freq"
              value={freq}
              onChange={(e) => setFreq(e.target.value as Freq)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
            >
              <option value="daily">Diariamente</option>
              <option value="weekly">Semanalmente</option>
              <option value="monthly">Mensualmente</option>
              <option value="custom">Personalizado (días específicos)</option>
            </select>
          </div>

          {freq === "custom" && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Días de la semana</p>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((d) => (
                  <label
                    key={d.value}
                    className="relative cursor-pointer text-center"
                  >
                    <input
                      type="checkbox"
                      name="recurrence_byday"
                      value={d.value}
                      defaultChecked={d.value === defaultByday}
                      className="peer sr-only"
                    />
                    <span
                      className="block rounded-md border border-gray-300 dark:border-gray-700 py-2 text-sm font-medium peer-checked:bg-black peer-checked:text-white peer-checked:border-black dark:peer-checked:bg-white dark:peer-checked:text-black dark:peer-checked:border-white"
                    >
                      {d.label}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                El día de inicio debe estar entre los marcados.
              </p>
            </div>
          )}

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
              defaultValue={defaultUntil}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
            />
          </div>

          <p className="text-xs text-gray-500">
            Las ocurrencias que choquen con otra reserva se saltan
            automáticamente. Máximo 365 ocurrencias.
          </p>
        </div>
      )}
    </fieldset>
  );
}

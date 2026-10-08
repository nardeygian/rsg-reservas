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
    <fieldset className="border-t border-line pt-4 space-y-3">
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
              className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}
            >
              Frecuencia
            </label>
            <select
              id="recurrence_freq"
              name="recurrence_freq"
              value={freq}
              onChange={(e) => setFreq(e.target.value as Freq)}
              className="input"
            >
              <option value="daily">Diariamente</option>
              <option value="weekly">Semanalmente</option>
              <option value="monthly">Mensualmente</option>
              <option value="custom">Personalizado (días específicos)</option>
            </select>
          </div>

          {freq === "custom" && (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>Días de la semana</p>
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
                      className="block rounded-[8px] border py-2 text-sm font-medium transition peer-checked:bg-[var(--color-accent)] peer-checked:text-[var(--color-accent-ink)] peer-checked:border-[var(--color-accent)]"
                      style={{ borderColor: "var(--color-line)" }}
                    >
                      {d.label}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                El día de inicio debe estar entre los marcados.
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="recurrence_until"
              className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}
            >
              Hasta
            </label>
            <input
              id="recurrence_until"
              name="recurrence_until"
              type="date"
              defaultValue={defaultUntil}
              className="input"
            />
          </div>

          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            Las ocurrencias que choquen con otra reserva se saltan
            automáticamente. Máximo 365 ocurrencias.
          </p>
        </div>
      )}
    </fieldset>
  );
}

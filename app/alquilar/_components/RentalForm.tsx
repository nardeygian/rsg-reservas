"use client";

import { useMemo, useState } from "react";
import { submitExternalBookingAction } from "../actions";
import { formatCents } from "@/lib/money";

type Space = {
  id: string;
  name: string;
  hourly_rate_cents: number;
};

type Item = {
  id: string;
  name: string;
  description: string | null;
  unit_price_cents: number;
  total_quantity: number;
};

export function RentalForm({
  spaces,
  items,
  defaultStart,
  defaultEnd,
}: {
  spaces: Space[];
  items: Item[];
  defaultStart: string;
  defaultEnd: string;
}) {
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? "");
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(defaultEnd);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const space = spaces.find((s) => s.id === spaceId);

  // hours puede ser fraccionario; multiplicamos por la tarifa exacta.
  const hours = useMemo(() => {
    if (!startsAt || !endsAt) return 0;
    const s = new Date(startsAt).getTime();
    const e = new Date(endsAt).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
    return (e - s) / 3_600_000;
  }, [startsAt, endsAt]);

  const spaceCostCents = space ? Math.round(hours * space.hourly_rate_cents) : 0;

  const itemsCostCents = useMemo(() => {
    return items.reduce((sum, it) => {
      const q = quantities[it.id] ?? 0;
      return sum + q * it.unit_price_cents;
    }, 0);
  }, [items, quantities]);

  const totalCents = spaceCostCents + itemsCostCents;

  return (
    <form
      action={submitExternalBookingAction}
      encType="multipart/form-data"
      className="space-y-4"
    >
      <div>
        <label htmlFor="space_id" className="block text-sm mb-1">
          Espacio
        </label>
        <select
          id="space_id"
          name="space_id"
          required
          value={spaceId}
          onChange={(e) => setSpaceId(e.target.value)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
        >
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {formatCents(s.hourly_rate_cents)}/hora
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
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
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
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="event_title" className="block text-sm mb-1">
          Nombre del evento <span className="text-gray-500">(opcional)</span>
        </label>
        <input
          id="event_title"
          name="event_title"
          type="text"
          maxLength={120}
          placeholder="Ej. Cumpleaños de María"
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
        />
      </div>

      {items.length > 0 && (
        <fieldset className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-2">
          <legend className="text-sm font-medium">
            Complementos disponibles
          </legend>
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex items-center gap-3 rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{it.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatCents(it.unit_price_cents)} c/u · {it.total_quantity}{" "}
                    disponibles
                  </p>
                </div>
                <input
                  type="number"
                  name={`item_qty_${it.id}`}
                  min={0}
                  max={it.total_quantity}
                  value={quantities[it.id] ?? 0}
                  onChange={(e) =>
                    setQuantities((q) => ({
                      ...q,
                      [it.id]: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  className="w-20 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm text-right tabular-nums"
                  aria-label={`Cantidad de ${it.name}`}
                />
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <section className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 px-4 py-3 space-y-1">
        <p className="text-xs uppercase tracking-wide text-blue-900 dark:text-blue-200">
          Total a pagar
        </p>
        <p className="text-2xl font-semibold">{formatCents(totalCents)}</p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {space?.name ?? "—"} · {hours.toFixed(1)} hora
          {hours === 1 ? "" : "s"} · {formatCents(spaceCostCents)} espacio +{" "}
          {formatCents(itemsCostCents)} complementos
        </p>
      </section>

      <fieldset className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
        <legend className="text-sm font-medium">Datos de contacto</legend>
        <div>
          <label htmlFor="client_name" className="block text-xs text-gray-500 mb-1">
            Nombre completo
          </label>
          <input
            id="client_name"
            name="client_name"
            type="text"
            required
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="client_email"
              className="block text-xs text-gray-500 mb-1"
            >
              Email
            </label>
            <input
              id="client_email"
              name="client_email"
              type="email"
              required
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
            />
          </div>
          <div>
            <label
              htmlFor="client_phone"
              className="block text-xs text-gray-500 mb-1"
            >
              Teléfono <span className="opacity-60">(opcional)</span>
            </label>
            <input
              id="client_phone"
              name="client_phone"
              type="tel"
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-2">
        <legend className="text-sm font-medium">Comprobante de pago</legend>
        <p className="text-xs text-gray-500">
          Realiza la transferencia por el total y adjunta el comprobante. La
          reserva queda en revisión hasta que un pastor la apruebe.
        </p>
        <input
          type="file"
          name="receipt"
          accept="image/png,image/jpeg,application/pdf"
          required
          className="block w-full text-sm"
        />
        <p className="text-xs text-gray-500">PDF, PNG o JPG. Máx 5 MB.</p>
      </fieldset>

      <button
        type="submit"
        className="w-full rounded-md bg-black text-white py-3 font-medium dark:bg-white dark:text-black"
      >
        Enviar solicitud · {formatCents(totalCents)}
      </button>
    </form>
  );
}

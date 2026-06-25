"use client";

import { useEffect, useMemo, useState } from "react";
import { submitExternalBookingAction } from "../actions";
import { formatCents } from "@/lib/money";
import { PAYMENT_INFO } from "@/lib/payment-info";
import { createClient } from "@/lib/supabase/client";
import { parseBogotaDatetimeLocal } from "@/lib/datetime";
import { SpaceAvailability } from "./SpaceAvailability";

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
  initialAvailability,
  defaultStart,
  defaultEnd,
}: {
  spaces: Space[];
  items: Item[];
  initialAvailability: Record<string, number>;
  defaultStart: string;
  defaultEnd: string;
}) {
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? "");
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(defaultEnd);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Record<string, number>>(
    initialAvailability
  );
  const [availLoading, setAvailLoading] = useState(false);

  function copy(value: string, label: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  // Refetch de disponibilidad cuando cambia la franja. Debounce 300ms para no
  // disparar RPCs en cada keystroke del datetime-local.
  useEffect(() => {
    const startUtc = parseBogotaDatetimeLocal(startsAt);
    const endUtc = parseBogotaDatetimeLocal(endsAt);
    if (!startUtc || !endUtc || endUtc <= startUtc) return;

    setAvailLoading(true);
    const handle = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("items_available", {
        _starts: startUtc.toISOString(),
        _ends: endUtc.toISOString(),
      });
      if (data) {
        const next: Record<string, number> = {};
        for (const a of data) next[a.item_id] = a.available;
        setAvailability(next);
        // Si alguna cantidad pedida supera el nuevo máximo, la recortamos.
        setQuantities((q) => {
          const adj: Record<string, number> = { ...q };
          for (const [itemId, qty] of Object.entries(q)) {
            const maxAvail = next[itemId] ?? 0;
            if (qty > maxAvail) adj[itemId] = maxAvail;
          }
          return adj;
        });
      }
      setAvailLoading(false);
    }, 300);

    return () => {
      clearTimeout(handle);
      setAvailLoading(false);
    };
  }, [startsAt, endsAt]);

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
      <div className="space-y-2">
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
            className="input"
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {formatCents(s.hourly_rate_cents)}/hora
              </option>
            ))}
          </select>
        </div>
        {spaceId && <SpaceAvailability spaceId={spaceId} />}
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
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="input"
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
          className="input"
        />
      </div>

      {items.length > 0 && (
        <fieldset className="border-t border-line pt-4 space-y-2">
          <legend className="eyebrow">
            Complementos disponibles{" "}
            {availLoading && (
              <span className="text-xs text-fg3 font-normal normal-case tracking-normal">
                · calculando…
              </span>
            )}
          </legend>
          <ul className="space-y-2">
            {items.map((it) => {
              const avail = availability[it.id] ?? it.total_quantity;
              const sold = avail === 0;
              return (
                <li
                  key={it.id}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
                    sold
                      ? "border-gray-200 dark:border-gray-800 opacity-60"
                      : "border-gray-200 dark:border-gray-800"
                  }`}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{it.name}</p>
                    <p className="text-xs text-fg2">
                      {formatCents(it.unit_price_cents)} c/u ·{" "}
                      {sold ? (
                        <span style={{ color: "var(--color-critical)" }}>
                          Sin disponibilidad en esa franja
                        </span>
                      ) : (
                        <>{avail} disponibles</>
                      )}
                    </p>
                  </div>
                  <input
                    type="number"
                    name={`item_qty_${it.id}`}
                    min={0}
                    max={avail}
                    value={quantities[it.id] ?? 0}
                    onChange={(e) =>
                      setQuantities((q) => ({
                        ...q,
                        [it.id]: Math.min(
                          avail,
                          Math.max(0, Number(e.target.value) || 0)
                        ),
                      }))
                    }
                    disabled={sold}
                    className="w-20 rounded-[10px] border border-line bg-bg-elev px-2 py-1 text-sm text-right tabular-nums disabled:opacity-50"
                    aria-label={`Cantidad de ${it.name}`}
                  />
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      <section
        className="rounded-[22px] px-5 py-4 space-y-1"
        style={{
          background: "var(--color-bg-invert)",
          color: "var(--color-fg-invert)",
        }}
      >
        <p className="eyebrow" style={{ color: "var(--color-fg-invert-2)" }}>
          Total a pagar
        </p>
        <p className="font-serif text-4xl tracking-[-0.02em]">
          {formatCents(totalCents)}
        </p>
        <p
          className="text-xs"
          style={{ color: "var(--color-fg-invert-2)" }}
        >
          {space?.name ?? "—"} · {hours.toFixed(1)} hora
          {hours === 1 ? "" : "s"} · {formatCents(spaceCostCents)} espacio +{" "}
          {formatCents(itemsCostCents)} complementos
        </p>
      </section>

      <section className="border-t border-line pt-4 space-y-3">
        <h2 className="eyebrow">¿Cómo pagar?</h2>
        <p className="text-xs text-gray-500">
          Realiza la transferencia por el total exacto antes de enviar la
          solicitud, y adjunta el comprobante más abajo.
        </p>

        <div className="card !p-4 space-y-3">
          {/* QR */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-24 h-24 rounded-[14px] border border-dashed border-line flex items-center justify-center text-xs text-fg3 bg-bg-muted">
              {PAYMENT_INFO.qrImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={PAYMENT_INFO.qrImageUrl}
                  alt="QR para pago"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-center px-2">QR (próximamente)</span>
              )}
            </div>
            <div className="flex-1 text-sm">
              <p className="font-medium">Escanea el QR</p>
              <p className="text-xs text-gray-500 mt-1">
                Abre tu app de Bancolombia y escanea para pagar.
              </p>
            </div>
          </div>

          {/* Llave */}
          <div className="border-t border-line pt-3">
            <p className="text-xs text-gray-500 mb-1">Llave Bancolombia</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-bg-muted rounded px-2 py-1.5">
                {PAYMENT_INFO.bancolombiaKey}
              </code>
              <button
                type="button"
                onClick={() =>
                  copy(PAYMENT_INFO.bancolombiaKey, "llave")
                }
                className="text-xs rounded-full border border-line px-3 py-1.5 hover:bg-bg-muted transition"
              >
                {copied === "llave" ? "Copiado ✓" : "Copiar"}
              </button>
            </div>
          </div>

          {/* Cuenta */}
          <div className="border-t border-line pt-3 space-y-1">
            <p className="text-xs text-gray-500">Cuenta Bancolombia</p>
            <p className="text-sm">
              <span className="text-gray-500">Tipo:</span>{" "}
              <strong>{PAYMENT_INFO.bancolombiaAccountType}</strong>
            </p>
            <p className="text-sm">
              <span className="text-gray-500">Titular:</span>{" "}
              {PAYMENT_INFO.bancolombiaAccountHolder}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-bg-muted rounded px-2 py-1.5">
                {PAYMENT_INFO.bancolombiaAccountNumber}
              </code>
              <button
                type="button"
                onClick={() =>
                  copy(PAYMENT_INFO.bancolombiaAccountNumber, "cuenta")
                }
                className="text-xs rounded-full border border-line px-3 py-1.5 hover:bg-bg-muted transition"
              >
                {copied === "cuenta" ? "Copiado ✓" : "Copiar"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <fieldset className="border-t border-line pt-4 space-y-3">
        <legend className="eyebrow">Datos de contacto</legend>
        <div>
          <label htmlFor="client_name" className="block text-xs text-gray-500 mb-1">
            Nombre completo
          </label>
          <input
            id="client_name"
            name="client_name"
            type="text"
            required
            className="input"
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
              className="input"
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
              className="input"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="border-t border-line pt-4 space-y-2">
        <legend className="eyebrow">Comprobante de pago</legend>
        <p className="text-xs text-gray-500">
          Realiza la transferencia por el total y adjunta el comprobante. Tu
          reserva quedará aprobada una vez confirmemos el pago.
        </p>

        <label
          htmlFor="receipt-input"
          className={`mt-2 flex flex-col items-center justify-center gap-1 cursor-pointer rounded-[14px] border-2 border-dashed px-4 py-6 text-center transition ${
            receiptFile
              ? "border-[color:var(--color-positive)] bg-sage-100"
              : "border-line hover:border-line-strong hover:bg-bg-muted"
          }`}
        >
          <input
            id="receipt-input"
            type="file"
            name="receipt"
            accept="image/png,image/jpeg,application/pdf"
            required
            onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
          {receiptFile ? (
            <>
              <p className="text-base font-medium">✓ {receiptFile.name}</p>
              <p className="text-xs text-fg2">Toca para cambiar de archivo</p>
            </>
          ) : (
            <>
              <p className="text-base font-medium">📎 Adjuntar comprobante</p>
              <p className="text-xs text-fg3">
                PDF, PNG o JPG · Máximo 5 MB
              </p>
            </>
          )}
        </label>
      </fieldset>

      <button type="submit" className="btn-primary w-full">
        Enviar solicitud · {formatCents(totalCents)}
      </button>
    </form>
  );
}

// Helpers para manejar dinero en centavos (COP). Guardamos cents en la base
// para evitar floats; convertimos a pesos solo en presentación o al recibir
// input del usuario.

const FORMATTER = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return FORMATTER.format(cents / 100);
}

// Acepta "50000", "50.000" o "50,000.50" y devuelve centavos (entero).
// Devuelve null si el input está vacío o no parsea.
export function parsePesosToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Quita separadores de miles ('.', ',', espacio) preservando el último
  // separador como decimal si es coma o punto.
  const sanitized = trimmed.replace(/[.\s]/g, "").replace(",", ".");
  const num = Number(sanitized);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

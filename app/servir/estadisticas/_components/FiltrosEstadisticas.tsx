"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const PERIODOS = [
  { value: "mes", label: "Este mes" },
  { value: "trimestre", label: "Últimos 3 meses" },
  { value: "semestre", label: "Últimos 6 meses" },
  { value: "anio", label: "Último año" },
] as const;

// Filtros en una fila sobre el tablero; viven en la URL para poder
// compartir la vista.
export function FiltrosEstadisticas({
  tipos, departamentos, conTipo,
}: {
  tipos: { id: string; name: string }[];
  departamentos: { id: string; name: string }[];
  conTipo: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function poner(clave: string, valor: string) {
    const next = new URLSearchParams(params.toString());
    if (valor) next.set(clave, valor);
    else next.delete(clave);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:gap-3">
      {conTipo && (
        <select aria-label="Periodo" className="input filter-select md:w-[200px]"
          value={params.get("periodo") ?? "trimestre"} onChange={(e) => poner("periodo", e.target.value)}>
          {PERIODOS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      )}
      {conTipo && (
        <select aria-label="Tipo de reunión" className="input filter-select md:w-[220px]"
          value={params.get("tipo") ?? ""} onChange={(e) => poner("tipo", e.target.value)}>
          <option value="">Todos los tipos</option>
          {tipos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      {departamentos.length > 1 && (
        <select aria-label="Departamento" className="input filter-select md:w-[220px]"
          value={params.get("dep") ?? ""} onChange={(e) => poner("dep", e.target.value)}>
          <option value="">Todos los departamentos</option>
          {departamentos.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      )}
    </div>
  );
}

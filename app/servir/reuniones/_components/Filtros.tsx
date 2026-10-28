"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function Filtros({
  tipos,
  estados,
}: {
  tipos: { id: string; name: string }[];
  estados: { value: string; label: string }[];
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
      <select
        aria-label="Filtrar por tipo"
        className="input filter-select md:w-[240px]"
        value={params.get("tipo") ?? ""}
        onChange={(e) => poner("tipo", e.target.value)}
      >
        <option value="">Todos los tipos</option>
        <option value="sin_tipo">Sin tipo</option>
        {tipos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <select
        aria-label="Filtrar por estado"
        className="input filter-select md:w-[180px]"
        value={params.get("estado") ?? ""}
        onChange={(e) => poner("estado", e.target.value)}
      >
        <option value="">Todos los estados</option>
        {estados.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </div>
  );
}

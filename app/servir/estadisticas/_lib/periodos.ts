// Periodos del tablero. Viven aparte del componente de filtros ("use client")
// porque la página, que es de servidor, también los lee: lo que exporta un
// módulo de cliente llega al servidor como referencia, no como valor.
export const PERIODOS = [
  { value: "mes", label: "Este mes" },
  { value: "trimestre", label: "Últimos 3 meses" },
  { value: "semestre", label: "Últimos 6 meses" },
  { value: "anio", label: "Último año" },
] as const;

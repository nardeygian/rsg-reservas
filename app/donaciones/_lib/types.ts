export type Donacion = {
  id: string;
  f: string;             // ISO timestamp
  m: number;             // monto COP (entero)
  n: string;             // nombre del donante
  k: string;             // clave estable del donante
  t: string;             // concepto: "Diezmo" | "Diezmo + Ofrenda" | "Ofrenda" | "Pro Casa"
  o: string;             // origen: "Módulo Dar" | nombre del formulario
  met: string;           // método: "PSE" | "CARD" | "NEQUI" | "BANCOLOMBIA_TRANSFER" | "Efectivo" | ...
  di?: string | null;    // discipulo_id (grupo primario)
  gid?: string | null;   // grupo_id (grupo primario)
  sg?: Record<string, string>; // grupos secundarios: {gid → di} — no suman en totales globales
  g?: string;            // nombre del grupo (enriquecido en cliente)
  e?: string;            // email (solo admin)
  doc?: string;          // documento (solo admin)
  ref?: string;          // referencia Wompi (solo admin)
};

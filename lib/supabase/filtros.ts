// Filtro de Realtime "columna=in.(a,b,c)" (admite hasta 100 valores).
// Va en un archivo común (no "use client") porque lo arman las páginas del
// servidor para pasárselo a <ActualizarEnVivo>.
export function filtroEn(columna: string, ids: string[]): string | undefined {
  const lista = [...new Set(ids)].slice(0, 100);
  return lista.length ? `${columna}=in.(${lista.join(",")})` : undefined;
}

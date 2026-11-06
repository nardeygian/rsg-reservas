import { NextResponse, type NextRequest } from "next/server";
import { leerTransaccionesFiscales } from "../_lib/data";
import { aplicarFiltros, filtrosDesdeParams, porFechaAsc, nombreArchivo } from "../_lib/fiscal-logic";
import { csv, xlsx } from "../_lib/export";

export const dynamic = "force-dynamic";

// Exporta una fila por transacción, en orden de fecha, sin agrupar.
// Los datos salen de la base con la sesión de quien descarga; la función
// donaciones_fiscales() decide si puede verlos.
export async function GET(req: NextRequest) {
  const formato = req.nextUrl.searchParams.get("formato") === "xlsx" ? "xlsx" : "csv";
  const filtros = filtrosDesdeParams(req.nextUrl.searchParams);

  const todas = await leerTransaccionesFiscales();
  if (todas === null) {
    return NextResponse.json({ ok: false, error: "Sin acceso" }, { status: 403 });
  }
  const filas = aplicarFiltros(todas, filtros).sort(porFechaAsc);
  const archivo = nombreArchivo(filtros, formato);
  const headers = {
    "Content-Disposition": `attachment; filename="${archivo}"`,
    "Cache-Control": "no-store",
  };

  if (formato === "csv") {
    return new NextResponse(csv(filas), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
    });
  }

  const buf = await xlsx(filas, filtros);
  return new NextResponse(new Uint8Array(buf), {
    headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  });
}

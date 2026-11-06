import ExcelJS from "exceljs";
import {
  filaExport, desglosar, partesBogota, COLUMNAS_EXPORT, etiquetaMetodo, hoyBogotaYMD,
  type FiltrosFiscales, type TxFiscal,
} from "./fiscal-logic";

// ── CSV (RFC 4180, UTF-8 con BOM para que Excel lea las tildes) ─────────────

function celdaCsv(v: string | number): string {
  if (typeof v === "number") return String(v);
  // Evita que una hoja de cálculo interprete el texto como fórmula.
  const s = /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csv(filas: TxFiscal[]): string {
  const lineas = [COLUMNAS_EXPORT.map(celdaCsv).join(",")];
  for (const t of filas) lineas.push(filaExport(t).map(celdaCsv).join(","));
  return "﻿" + lineas.join("\r\n") + "\r\n";
}

// ── Excel ───────────────────────────────────────────────────────────────────

const FORMATO_COP = '"$"#,##0';

/** Fecha que Excel muestra igual que la hora de Bogotá. */
function fechaExcel(iso: string): Date {
  const p = partesBogota(iso);
  return new Date(Date.UTC(p.y, p.m, p.d, p.h, p.mi, p.s));
}

export async function xlsx(filas: TxFiscal[], f: FiltrosFiscales): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Panel RSG";
  wb.created = new Date();

  // Hoja 1: transacciones
  const ws = wb.addWorksheet("Transacciones", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Fecha y hora", key: "fecha", width: 18, style: { numFmt: "yyyy-mm-dd hh:mm" } },
    { header: "Monto (COP)", key: "monto", width: 14, style: { numFmt: FORMATO_COP } },
    { header: "Medio de pago", key: "metodo", width: 16 },
    { header: "Concepto", key: "concepto", width: 18 },
    { header: "Origen", key: "origen", width: 22 },
    { header: "Referencia de pago", key: "ref", width: 26 },
    { header: "ID de transacción", key: "id", width: 28 },
    { header: "Donante", key: "donante", width: 30 },
    { header: "Documento", key: "doc", width: 16 },
    { header: "Email", key: "email", width: 30 },
  ];
  for (const t of filas) {
    ws.addRow({
      fecha: fechaExcel(t.fecha), monto: t.monto, metodo: etiquetaMetodo(t.metodo_pago),
      concepto: t.concepto ?? "", origen: t.origen ?? "", ref: t.referencia ?? "", id: t.id,
      donante: t.donante, doc: t.documento ?? "", email: t.email ?? "",
    });
  }
  ws.getRow(1).font = { bold: true };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  if (filas.length > 0) {
    const total = ws.addRow({ fecha: "Total", monto: { formula: `SUM(B2:B${filas.length + 1})` } });
    total.font = { bold: true };
  }

  // Hoja 2: resumen del archivo
  const rs = wb.addWorksheet("Resumen");
  rs.columns = [{ width: 28 }, { width: 18 }, { width: 14 }];
  const rango = `${f.desde ?? "Desde el inicio"} a ${f.hasta ?? hoyBogotaYMD()}`;
  rs.addRow(["Reporte de donaciones"]).font = { bold: true, size: 14 };
  rs.addRow(["Periodo", rango]);
  if (f.metodo) rs.addRow(["Medio de pago", etiquetaMetodo(f.metodo)]);
  if (f.concepto) rs.addRow(["Concepto", f.concepto]);
  if (f.origen) rs.addRow(["Origen", f.origen]);
  if (f.q) rs.addRow(["Búsqueda", f.q]);
  rs.addRow(["Generado", new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })]);
  rs.addRow([]);
  const total = filas.reduce((s, t) => s + t.monto, 0);
  rs.addRow(["Total recaudado", total]).getCell(2).numFmt = FORMATO_COP;
  rs.addRow(["Transacciones", filas.length]);

  const seccion = (titulo: string, campo: "metodo_pago" | "concepto" | "origen") => {
    rs.addRow([]);
    const h = rs.addRow([titulo, "Total", "Transacciones"]);
    h.font = { bold: true };
    for (const d of desglosar(filas, campo)) {
      rs.addRow([d.etiqueta, d.total, d.n]).getCell(2).numFmt = FORMATO_COP;
    }
  };
  seccion("Por medio de pago", "metodo_pago");
  seccion("Por concepto", "concepto");
  seccion("Por origen", "origen");

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

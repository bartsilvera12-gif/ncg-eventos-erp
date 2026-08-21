/**
 * Util generico para exportar a Excel (.xlsx).
 *
 * Genera hojas con estilo aplicado (fondo teal en header, banding zebra en filas,
 * bordes finos, freeze del header y autoFilter) usando xlsx-js-style.
 *
 * No depende de Campañas. NO se debe tocar src/lib/campaigns/campaign-import-service.ts.
 */
import * as XLSX from "xlsx-js-style";

// ── Estilos base compartidos ─────────────────────────────────────────────────
const BRAND_TEAL = "FF4FAEB2";
const BRAND_TEAL_DARK = "FF3F8E91";
const HEADER_TEXT = "FFFFFFFF";
const ZEBRA_BG = "FFF6FAFB";
const BORDER_COLOR = "FFE2E8F0";

type CellStyle = Record<string, unknown>;

const thinBorder = {
  top: { style: "thin", color: { rgb: BORDER_COLOR } },
  bottom: { style: "thin", color: { rgb: BORDER_COLOR } },
  left: { style: "thin", color: { rgb: BORDER_COLOR } },
  right: { style: "thin", color: { rgb: BORDER_COLOR } },
};

const HEADER_STYLE: CellStyle = {
  fill: { patternType: "solid", fgColor: { rgb: BRAND_TEAL } },
  font: { name: "Calibri", sz: 11, bold: true, color: { rgb: HEADER_TEXT } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: BRAND_TEAL_DARK } },
    bottom: { style: "medium", color: { rgb: BRAND_TEAL_DARK } },
    left: { style: "thin", color: { rgb: BRAND_TEAL_DARK } },
    right: { style: "thin", color: { rgb: BRAND_TEAL_DARK } },
  },
};

function bodyStyle(rowIdx: number): CellStyle {
  const isEven = rowIdx % 2 === 0;
  return {
    font: { name: "Calibri", sz: 10, color: { rgb: "FF1E293B" } },
    alignment: { vertical: "center", wrapText: true },
    fill: isEven ? { patternType: "solid", fgColor: { rgb: ZEBRA_BG } } : undefined,
    border: thinBorder,
  };
}

function numberBodyStyle(rowIdx: number): CellStyle {
  return {
    ...bodyStyle(rowIdx),
    alignment: { vertical: "center", horizontal: "right" },
  };
}

/** Coloca headerStyle/bodyStyle/anchos/freeze/autoFilter sobre una worksheet ya creada. */
function decorateSheet(ws: XLSX.WorkSheet, colCount: number, rowCount: number, colWidths?: number[]) {
  // Anchos
  if (colWidths && colWidths.length > 0) {
    ws["!cols"] = colWidths.map((w) => ({ wch: w }));
  }
  // Alto del header
  ws["!rows"] = [{ hpt: 22 }];
  // Freeze row 1
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  // AutoFilter en el rango del header
  if (colCount > 0 && rowCount > 0) {
    const endCol = XLSX.utils.encode_col(colCount - 1);
    const endRow = rowCount; // rowCount incluye header
    ws["!autofilter"] = { ref: `A1:${endCol}${endRow}` };
  }
  // Aplicar estilos celda por celda
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      if (r === 0) {
        cell.s = HEADER_STYLE;
      } else {
        const isNum = typeof cell.v === "number";
        cell.s = isNum ? numberBodyStyle(r) : bodyStyle(r);
      }
    }
  }
}

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined | Date;
  /** Ancho aproximado en caracteres (opcional). */
  width?: number;
}

export interface ExportOptions {
  sheetName?: string;
  filename?: string;
}

export function buildXlsxBuffer<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  opts: ExportOptions = {}
): Buffer {
  const sheetName = (opts.sheetName ?? "Datos").slice(0, 31);
  const headerRow = columns.map((c) => c.header);
  const dataRows = rows.map((row) =>
    columns.map((c) => {
      const v = c.value(row);
      if (v == null) return "";
      if (v instanceof Date) return v;
      return v;
    })
  );
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  decorateSheet(
    ws,
    columns.length,
    dataRows.length + 1,
    columns.map((c) => c.width ?? 16)
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return buf;
}

export interface XlsxSheetSpec {
  sheetName: string;
  aoa: (string | number | boolean | Date)[][];
  colWidths?: number[];
}

export function sheetFromRows<T>(
  sheetName: string,
  rows: T[],
  columns: ExportColumn<T>[]
): XlsxSheetSpec {
  const header = columns.map((c) => c.header);
  const data = rows.map((row) =>
    columns.map((c) => {
      const v = c.value(row);
      if (v == null) return "";
      return v;
    })
  );
  return {
    sheetName: sheetName.slice(0, 31),
    aoa: [header, ...data],
    colWidths: columns.map((c) => c.width ?? 16),
  };
}

export function buildXlsxBufferSheets(sheets: XlsxSheetSpec[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.aoa);
    decorateSheet(ws, (s.aoa[0]?.length ?? 0), s.aoa.length, s.colWidths);
    XLSX.utils.book_append_sheet(wb, ws, s.sheetName.slice(0, 31));
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function xlsxResponseHeaders(filename: string): HeadersInit {
  const safe = filename.replace(/[^a-zA-Z0-9_.-]+/g, "_");
  return {
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${safe}.xlsx"`,
    "Cache-Control": "no-store",
  };
}

export function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

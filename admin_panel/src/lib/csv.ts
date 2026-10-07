import { downloadExcel, type ExcelCell } from "./excel";

/** Eski chaqiruvlar uchun: endi haqiqiy Excel (.xlsx) fayl yuklanadi. */
export function downloadCsv(filename: string, headers: string[], rows: ExcelCell[][], sheetName = "Ma'lumotlar") {
  downloadExcel(filename, { name: sheetName, headers, rows });
}

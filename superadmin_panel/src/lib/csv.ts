type Cell = string | number | null | undefined;

function escapeCell(value: Cell) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Excel'da o'zbekcha matn buzilmasligi uchun BOM va `;` ajratgich ishlatiladi. */
export function downloadCsv(filename: string, headers: string[], rows: Cell[][]) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(";"));
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

"use client";

import * as XLSX from "xlsx";
import { Download } from "lucide-react";

export function RekapExportButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  function handleExport() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((_, i) => ({ wch: i < 3 ? 16 : 10 }));
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Stok");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
    >
      <Download className="w-4 h-4" />
      Export Excel
    </button>
  );
}

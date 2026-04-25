"use client";

import * as XLSX from "xlsx";
import { Download } from "lucide-react";

export function DashboardExportButton({
  rows,
}: {
  rows: { nomor: string; klien: string; periode: string; total: number; status: string }[];
}) {
  function handleExport() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nomor", "Klien", "Periode", "Total (Rp)", "Status"],
      ...rows.map((r) => [r.nomor, r.klien, r.periode, r.total, r.status]),
    ]);
    ws["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 24 }, { wch: 16 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Tagihan");
    XLSX.writeFile(wb, `rekap_tagihan_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (rows.length === 0) return null;

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
    >
      <Download className="w-3.5 h-3.5" />
      Export Excel
    </button>
  );
}

"use client";

import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Upload, Download, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  importAlatAction,
  importKlienAction,
  importStokGudangAction,
  importStokProyekAction,
  importKontrakAction,
  importHargaAction,
  type AlatImportRow,
  type KlienImportRow,
  type StokGudangImportRow,
  type StokProyekImportRow,
  type KontrakImportRow,
  type HargaImportRow,
} from "../actions";

type Tab = "alat" | "klien" | "stok_gudang" | "stok_proyek" | "kontrak" | "harga";

const TABS: { key: Tab; label: string }[] = [
  { key: "alat", label: "Daftar Alat" },
  { key: "klien", label: "Daftar Klien / Proyek" },
  { key: "stok_gudang", label: "Stok Gudang" },
  { key: "stok_proyek", label: "Stok Proyek" },
  { key: "kontrak", label: "Kontrak Sewa" },
  { key: "harga", label: "Harga Sewa" },
];

// ── Template generators ───────────────────────────────────────

function downloadTemplate(tab: Tab) {
  const wb = XLSX.utils.book_new();
  let ws: XLSX.WorkSheet;
  let sheetName: string;

  if (tab === "alat") {
    ws = XLSX.utils.aoa_to_sheet([
      ["Kode", "Nama", "Satuan Default"],
      ["MF170", "Main Frame 170", "Unit"],
      ["CB220", "Cross Brace 220", "Unit"],
    ]);
    sheetName = "Alat";
  } else if (tab === "klien") {
    ws = XLSX.utils.aoa_to_sheet([
      ["Kode", "Nama", "PIC Nama", "PIC Kontak"],
      ["ASTEMO", "PT Astemo", "Budi", "0812-xxx-xxxx"],
      ["NOK", "PT Nok", "", ""],
    ]);
    sheetName = "Klien";
  } else if (tab === "stok_gudang") {
    ws = XLSX.utils.aoa_to_sheet([
      ["Kode Alat", "Qty"],
      ["MF170", 100],
      ["CB220", 80],
    ]);
    sheetName = "Stok Gudang";
  } else if (tab === "stok_proyek") {
    ws = XLSX.utils.aoa_to_sheet([
      ["Kode Klien", "Kode Alat", "Qty"],
      ["ASTEMO", "MF170", 20],
      ["NOK", "CB220", 15],
    ]);
    sheetName = "Stok Proyek";
  } else if (tab === "kontrak") {
    ws = XLSX.utils.aoa_to_sheet([
      ["Kode Klien", "Nomor Kontrak", "Tanggal Mulai", "Tanggal Selesai", "Apply PPN (Y/N)", "Tgl Tutup Periode"],
      ["ASTEMO", "KTR-ASTEMO-2024", "2024-01-01", "2024-12-31", "Y", 25],
      ["NOK", "KTR-NOK-2024", "2024-03-01", "", "N", ""],
    ]);
    sheetName = "Kontrak";
  } else {
    ws = XLSX.utils.aoa_to_sheet([
      ["Nomor Kontrak", "Kode Alat", "Harga Bulanan"],
      ["KTR-ASTEMO-2024", "MF170", 150000],
      ["KTR-ASTEMO-2024", "CB220", 75000],
    ]);
    sheetName = "Harga Sewa";
  }

  // Set column widths
  ws["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `template_${tab}.xlsx`);
}

// ── Parse uploaded file ───────────────────────────────────────

function parseFile(file: File): Promise<unknown[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
        resolve(rows);
      } catch {
        reject(new Error("Gagal membaca file. Pastikan format Excel (.xlsx/.xls)"));
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsArrayBuffer(file);
  });
}

// ── Preview table component ───────────────────────────────────

function PreviewTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-64 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 sticky top-0">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-slate-50">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                  {String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── ImportPanel component ─────────────────────────────────────

function ImportPanel({ tab }: { tab: Tab }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<(string | number)[][]>([]);
  const [rawData, setRawData] = useState<unknown[][]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    inserted?: number;
    upserted?: number;
    skipped?: number;
    errors?: string[];
  } | null>(null);
  // Reset state when tab changes (handled by key prop on ImportPanel)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setResult(null);
    if (!f) { setFile(null); setPreviewRows([]); return; }
    setFile(f);

    try {
      const rows = await parseFile(f);
      setRawData(rows);
      if (rows.length < 2) { toast.error("File kosong atau tidak ada data"); return; }
      const [headerRow, ...dataRows] = rows;
      setPreviewHeaders((headerRow as unknown[]).map(String));
      setPreviewRows(
        dataRows.slice(0, 20).map((r) => (r as unknown[]).map((c) => c as string | number))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membaca file");
      setFile(null);
    }
  }

  async function handleCommit() {
    if (!rawData || rawData.length < 2) return;
    const dataRows = rawData.slice(1).filter((r) => {
      const arr = r as unknown[];
      return arr.some((c) => c !== "" && c != null);
    });

    setLoading(true);
    setResult(null);

    try {
      if (tab === "alat") {
        const rows: AlatImportRow[] = dataRows.map((r) => {
          const arr = r as unknown[];
          return { kode: String(arr[0] ?? ""), nama: String(arr[1] ?? ""), satuan_default: String(arr[2] ?? "Unit") };
        });
        const res = await importAlatAction(rows);
        if (!res.success) { toast.error(res.error); return; }
        setResult(res.data ?? {});
        toast.success(`Import selesai: ${res.data?.inserted ?? 0} baris ditambahkan`);
      } else if (tab === "klien") {
        const rows: KlienImportRow[] = dataRows.map((r) => {
          const arr = r as unknown[];
          return { kode: String(arr[0] ?? ""), nama: String(arr[1] ?? ""), pic_nama: String(arr[2] ?? ""), pic_kontak: String(arr[3] ?? "") };
        });
        const res = await importKlienAction(rows);
        if (!res.success) { toast.error(res.error); return; }
        setResult(res.data ?? {});
        toast.success(`Import selesai: ${res.data?.inserted ?? 0} baris ditambahkan`);
      } else if (tab === "stok_gudang") {
        const rows: StokGudangImportRow[] = dataRows.map((r) => {
          const arr = r as unknown[];
          return { kode_alat: String(arr[0] ?? ""), qty: Number(arr[1]) };
        });
        const res = await importStokGudangAction(rows);
        if (!res.success) { toast.error(res.error); return; }
        setResult(res.data ?? {});
        toast.success(`Import selesai: ${res.data?.upserted ?? 0} baris diperbarui`);
      } else if (tab === "stok_proyek") {
        const rows: StokProyekImportRow[] = dataRows.map((r) => {
          const arr = r as unknown[];
          return { kode_klien: String(arr[0] ?? ""), kode_alat: String(arr[1] ?? ""), qty: Number(arr[2]) };
        });
        const res = await importStokProyekAction(rows);
        if (!res.success) { toast.error(res.error); return; }
        setResult(res.data ?? {});
        toast.success(`Import selesai: ${res.data?.upserted ?? 0} baris diperbarui`);
      } else if (tab === "kontrak") {
        const rows: KontrakImportRow[] = dataRows.map((r) => {
          const arr = r as unknown[];
          return {
            kode_klien: String(arr[0] ?? ""),
            nomor_kontrak: String(arr[1] ?? ""),
            tanggal_mulai: String(arr[2] ?? ""),
            tanggal_selesai: String(arr[3] ?? ""),
            apply_ppn: String(arr[4] ?? ""),
            tgl_tutup_periode: String(arr[5] ?? ""),
          };
        });
        const res = await importKontrakAction(rows);
        if (!res.success) { toast.error(res.error); return; }
        setResult(res.data ?? {});
        toast.success(`Import selesai: ${res.data?.inserted ?? 0} kontrak ditambahkan`);
      } else {
        const rows: HargaImportRow[] = dataRows.map((r) => {
          const arr = r as unknown[];
          return {
            nomor_kontrak: String(arr[0] ?? ""),
            kode_alat: String(arr[1] ?? ""),
            harga_bulanan: String(arr[2] ?? ""),
          };
        });
        const res = await importHargaAction(rows);
        if (!res.success) { toast.error(res.error); return; }
        setResult(res.data ?? {});
        toast.success(`Import selesai: ${res.data?.upserted ?? 0} harga diperbarui`);
      }
    } finally {
      setLoading(false);
    }
  }

  const labels: Record<Tab, { headers: string[]; description: string }> = {
    alat: {
      headers: ["Kode", "Nama", "Satuan Default"],
      description: "Import daftar alat perancah. Alat dengan kode sudah ada akan dilewati (tidak duplikat).",
    },
    klien: {
      headers: ["Kode", "Nama", "PIC Nama", "PIC Kontak"],
      description: "Import daftar klien/proyek. Klien dengan kode sudah ada akan dilewati.",
    },
    stok_gudang: {
      headers: ["Kode Alat", "Qty"],
      description: "Import stok gudang utama. Akan menimpa (upsert) stok yang sudah ada berdasarkan kode alat.",
    },
    stok_proyek: {
      headers: ["Kode Klien", "Kode Alat", "Qty"],
      description: "Import sisa stok di proyek per 31/12/2025. Akan menimpa (upsert) stok yang sudah ada.",
    },
    kontrak: {
      headers: ["Kode Klien", "Nomor Kontrak", "Tanggal Mulai", "Tanggal Selesai", "Apply PPN (Y/N)", "Tgl Tutup Periode"],
      description: "Import kontrak sewa. Kontrak dengan nomor yang sama akan dilewati. Tanggal format YYYY-MM-DD.",
    },
    harga: {
      headers: ["Nomor Kontrak", "Kode Alat", "Harga Bulanan"],
      description: "Import harga sewa per alat per kontrak. Akan menimpa (upsert) harga yang sudah ada.",
    },
  };

  const info = labels[tab];

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">{info.description}</p>

      {/* Step 1: Download template */}
      <div className="flex items-center gap-3">
        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">1</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-700 mb-1">Download template Excel</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadTemplate(tab)}
            className="gap-1.5"
          >
            <Download className="w-4 h-4" /> Download Template
          </Button>
        </div>
      </div>

      {/* Step 2: Upload file */}
      <div className="flex items-start gap-3">
        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-1">2</span>
        <div className="flex-1 space-y-3">
          <p className="text-sm font-medium text-slate-700">Upload file Excel yang sudah diisi</p>
          <label className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <Upload className="w-5 h-5 text-slate-400" />
            <span className="text-sm text-slate-500">
              {file ? file.name : "Klik untuk pilih file (.xlsx, .xls)"}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>

          {/* Preview */}
          {previewRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">
                Preview data ({previewRows.length} baris{previewRows.length === 20 ? "+" : ""} dari file):
              </p>
              <PreviewTable headers={previewHeaders} rows={previewRows} />
            </div>
          )}
        </div>
      </div>

      {/* Step 3: Commit */}
      {previewRows.length > 0 && (
        <div className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-1">3</span>
          <div className="flex-1 space-y-3">
            <p className="text-sm font-medium text-slate-700">Konfirmasi import ke database</p>
            <Button
              onClick={handleCommit}
              disabled={loading}
              className="gap-1.5"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Mengimport…</>
              ) : (
                <><CheckCircle className="w-4 h-4" /> Commit Import</>
              )}
            </Button>

            {/* Result */}
            {result && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Import selesai:{" "}
                    <strong>{result.inserted ?? result.upserted ?? 0}</strong> baris berhasil
                    {result.skipped != null && result.skipped > 0 ? `, ${result.skipped} dilewati (sudah ada)` : ""}
                  </span>
                </div>
                {result.errors && result.errors.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-amber-700 flex items-center gap-1 mb-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {result.errors.length} baris gagal:
                    </p>
                    <ul className="text-xs text-amber-800 space-y-0.5 list-disc pl-4">
                      {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                      {result.errors.length > 10 && <li>…dan {result.errors.length - 10} lainnya</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────

export function MigrasiClient() {
  const [activeTab, setActiveTab] = useState<Tab>("alat");

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <strong>Perhatian:</strong> Fitur ini untuk migrasi data awal satu kali. Import stok akan
        menimpa data yang ada. Pastikan data sudah diverifikasi sebelum commit.
      </div>

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? "border-blue-600 text-blue-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <ImportPanel key={activeTab} tab={activeTab} />
      </div>
    </div>
  );
}

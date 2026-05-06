import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils";
import type { TipeTransaksi } from "@/types/database";

export const metadata: Metadata = { title: "Stok Gudang" };

const TIPE_LABEL: Partial<Record<TipeTransaksi, string>> = {
  PENGIRIMAN: "Pengiriman",
  RETUR: "Retur",
  STOCK_ADJUSTMENT: "Penyesuaian",
};

const TIPE_COLOR: Partial<Record<TipeTransaksi, string>> = {
  PENGIRIMAN: "bg-blue-50 text-blue-700",
  RETUR: "bg-amber-50 text-amber-700",
  STOCK_ADJUSTMENT: "bg-slate-100 text-slate-600",
};

type StokItem = {
  id: string;
  qty_tersedia: number;
  updated_at: string;
  alat: {
    id: string;
    kode: string;
    nama: string;
    satuan_default: string;
    is_active: boolean;
  } | null;
};

type HistoryRow = {
  transaksi_id: string;
  tanggal: string;
  tipe: TipeTransaksi;
  no_sj: string | null;
  alat_kode: string;
  alat_nama: string;
  delta: number;
};

export default async function GudangPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { role } = await requireAuth();
  const supabase = await createClient();
  const sp = await searchParams;

  const filterDari = sp.dari ?? "";
  const filterSampai = sp.sampai ?? "";
  const filterAlatId = sp.alat ?? "";

  const [stokResult, alatResult] = await Promise.all([
    supabase
      .from("stok_gudang")
      .select("id, qty_tersedia, updated_at, alat:alat_id(id, kode, nama, satuan_default, is_active)")
      .order("alat_id"),
    supabase.from("alat").select("id, kode, nama").eq("is_active", true).order("kode"),
  ]);

  const stokList = (stokResult.data ?? []) as unknown as StokItem[];
  const alatList = (alatResult.data ?? []) as { id: string; kode: string; nama: string }[];

  // Fetch mutation history
  let historyQuery = supabase
    .from("transaksi")
    .select(
      "id, tipe, tanggal, no_sj, transaksi_item(qty, alat:alat_id(id, kode, nama))"
    )
    .eq("status", "APPROVED")
    .in("tipe", ["PENGIRIMAN", "RETUR", "STOCK_ADJUSTMENT"])
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (filterDari) historyQuery = historyQuery.gte("tanggal", filterDari);
  if (filterSampai) historyQuery = historyQuery.lte("tanggal", filterSampai);

  const { data: txnRaw } = await historyQuery;

  type TxnRaw = {
    id: string;
    tipe: TipeTransaksi;
    tanggal: string;
    no_sj: string | null;
    transaksi_item: { qty: number; alat: { id: string; kode: string; nama: string } | null }[];
  };

  const txnList = (txnRaw ?? []) as unknown as TxnRaw[];

  // Flatten into history rows with signed delta
  const allHistory: HistoryRow[] = [];
  for (const txn of txnList) {
    for (const item of txn.transaksi_item ?? []) {
      if (!item.alat) continue;
      if (filterAlatId && item.alat.id !== filterAlatId) continue;
      const delta =
        txn.tipe === "PENGIRIMAN" ? -item.qty : item.qty;
      allHistory.push({
        transaksi_id: txn.id,
        tanggal: txn.tanggal,
        tipe: txn.tipe,
        no_sj: txn.no_sj,
        alat_kode: item.alat.kode,
        alat_nama: item.alat.nama,
        delta,
      });
    }
  }

  const hasFilter = filterDari || filterSampai || filterAlatId;

  return (
    <>
      <PageHeader
        title="Stok Gudang"
        description={`${stokList.length} jenis alat terdaftar`}
        action={
          role === "ADMIN" ? (
            <Link href="/transaksi">
              <Button size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1.5" /> Buat Transaksi
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* Current stock table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Kode</TableHead>
              <TableHead>Nama Alat</TableHead>
              <TableHead className="w-20">Satuan</TableHead>
              <TableHead className="w-36 text-right">Stok Tersedia</TableHead>
              <TableHead className="w-36">Diperbarui</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stokList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-slate-400 text-sm">
                  Belum ada data stok. Tambahkan alat terlebih dahulu di Master → Alat.
                </TableCell>
              </TableRow>
            ) : (
              stokList.map((s) => (
                <TableRow
                  key={s.id}
                  className={!s.alat?.is_active ? "opacity-40" : ""}
                >
                  <TableCell className="font-mono text-sm">{s.alat?.kode ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {s.alat?.nama ?? "—"}
                    {!s.alat?.is_active && (
                      <span className="ml-2 text-xs text-slate-400">(nonaktif)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {s.alat?.satuan_default ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {s.qty_tersedia < 0 && (
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-red-100 text-red-700 rounded"
                          title="Stok minus karena pernah ada PENGIRIMAN dengan Override Stok Minus dicentang"
                        >
                          Minus
                        </span>
                      )}
                      <span
                        className={`text-sm font-semibold ${
                          s.qty_tersedia < 0
                            ? "text-red-600"
                            : s.qty_tersedia === 0
                            ? "text-slate-400"
                            : "text-slate-900"
                        }`}
                      >
                        {s.qty_tersedia.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-400">
                    {formatDateShort(s.updated_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mutation history */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-slate-800 mb-3">Riwayat Mutasi Gudang</h2>

        {/* Filter form */}
        <form method="GET" className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-end mb-4">
          <div className="flex-1 min-w-36 space-y-1">
            <label className="text-xs font-medium text-slate-500">Alat</label>
            <select
              name="alat"
              defaultValue={filterAlatId}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Semua alat</option>
              {alatList.map((a) => (
                <option key={a.id} value={a.id}>{a.kode} — {a.nama}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Tanggal dari</label>
            <input
              type="date"
              name="dari"
              defaultValue={filterDari}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Sampai</label>
            <input
              type="date"
              name="sampai"
              defaultValue={filterSampai}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex items-center px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
            >
              Terapkan
            </button>
            {hasFilter && (
              <Link
                href="/gudang"
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-slate-200 text-slate-500 text-sm hover:text-slate-700 transition-colors"
              >
                Reset
              </Link>
            )}
          </div>
        </form>

        {/* History table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Tanggal</TableHead>
                <TableHead className="w-32">Tipe</TableHead>
                <TableHead className="w-28">No. SJ</TableHead>
                <TableHead>Alat</TableHead>
                <TableHead className="w-28 text-right">Delta Stok</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-slate-400 text-sm">
                    Belum ada riwayat mutasi{hasFilter ? " (coba ubah filter)" : ""}
                  </TableCell>
                </TableRow>
              ) : (
                allHistory.map((h, i) => (
                  <TableRow key={`${h.transaksi_id}-${h.alat_kode}-${i}`}>
                    <TableCell className="text-sm">{formatDateShort(h.tanggal)}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPE_COLOR[h.tipe] ?? ""}`}>
                        {TIPE_LABEL[h.tipe] ?? h.tipe}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{h.no_sj ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      <Link
                        href={`/transaksi/${h.transaksi_id}`}
                        className="hover:underline text-slate-700"
                      >
                        <span className="font-mono text-xs text-slate-500 mr-1.5">{h.alat_kode}</span>
                        {h.alat_nama}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-sm font-semibold font-mono ${
                        h.delta > 0 ? "text-emerald-600" : h.delta < 0 ? "text-red-500" : "text-slate-400"
                      }`}>
                        {h.delta > 0 ? "+" : ""}{h.delta.toLocaleString("id-ID")}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {allHistory.length >= 500 && (
          <p className="text-xs text-slate-400 mt-2 text-center">Menampilkan 500 entri terakhir. Gunakan filter untuk mempersempit.</p>
        )}
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { TransaksiStatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils";
import { TransaksiFormDialog } from "./transaksi-form";
import type { KlienOption, AlatOption, KontrakOption } from "./transaksi-form";
import type { TipeTransaksi, TransaksiStatus } from "@/types/database";

const TIPE_LABEL: Record<TipeTransaksi, string> = {
  PENGIRIMAN: "Pengiriman",
  RETUR: "Retur",
  TRANSFER: "Transfer",
  CLAIM: "Claim",
  STOCK_ADJUSTMENT: "Penyesuaian Stok",
};

const TIPE_COLOR: Record<TipeTransaksi, string> = {
  PENGIRIMAN: "bg-blue-50 text-blue-700",
  RETUR: "bg-amber-50 text-amber-700",
  TRANSFER: "bg-purple-50 text-purple-700",
  CLAIM: "bg-red-50 text-red-700",
  STOCK_ADJUSTMENT: "bg-slate-100 text-slate-600",
};

type TransaksiListItem = {
  id: string;
  tipe: TipeTransaksi;
  tanggal: string;
  no_sj: string | null;
  status: TransaksiStatus;
  created_at: string;
  klien: { kode: string; nama: string } | null;
  klien_tujuan: { kode: string; nama: string } | null;
  created_by_user: { nama: string } | null;
  items: { alat_id: string }[];
};

type Tab = "SEMUA" | TransaksiStatus;

const TABS: { value: Tab; label: string }[] = [
  { value: "SEMUA", label: "Semua" },
  { value: "PENDING_APPROVAL", label: "Menunggu" },
  { value: "APPROVED", label: "Disetujui" },
  { value: "REJECTED", label: "Ditolak" },
  { value: "VOID", label: "Void" },
];

const TIPE_OPTIONS: TipeTransaksi[] = [
  "PENGIRIMAN", "RETUR", "TRANSFER", "CLAIM", "STOCK_ADJUSTMENT",
];

export function TransaksiListClient({
  transaksiList,
  isAdmin,
  klienList,
  alatList,
  kontrakList,
}: {
  transaksiList: TransaksiListItem[];
  isAdmin: boolean;
  klienList: KlienOption[];
  alatList: AlatOption[];
  kontrakList: KontrakOption[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("SEMUA");
  const [openCreate, setOpenCreate] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  // Filters
  const [filterKlienId, setFilterKlienId] = useState("");
  const [filterAlatId, setFilterAlatId] = useState("");
  const [filterTipe, setFilterTipe] = useState<TipeTransaksi | "">("");
  const [filterDari, setFilterDari] = useState("");
  const [filterSampai, setFilterSampai] = useState("");

  const hasActiveFilter = filterKlienId || filterAlatId || filterTipe || filterDari || filterSampai;

  function clearFilters() {
    setFilterKlienId("");
    setFilterAlatId("");
    setFilterTipe("");
    setFilterDari("");
    setFilterSampai("");
  }

  const filtered = transaksiList.filter((t) => {
    if (activeTab !== "SEMUA" && t.status !== activeTab) return false;
    if (filterKlienId) {
      const match =
        t.klien?.kode === klienList.find((k) => k.id === filterKlienId)?.kode ||
        t.klien_tujuan?.kode === klienList.find((k) => k.id === filterKlienId)?.kode;
      if (!match) return false;
    }
    if (filterAlatId && !t.items.some((i) => i.alat_id === filterAlatId)) return false;
    if (filterTipe && t.tipe !== filterTipe) return false;
    if (filterDari && t.tanggal < filterDari) return false;
    if (filterSampai && t.tanggal > filterSampai) return false;
    return true;
  });

  const counts: Record<Tab, number> = {
    SEMUA: transaksiList.filter((t) => {
      if (filterKlienId) {
        const kode = klienList.find((k) => k.id === filterKlienId)?.kode;
        if (t.klien?.kode !== kode && t.klien_tujuan?.kode !== kode) return false;
      }
      if (filterAlatId && !t.items.some((i) => i.alat_id === filterAlatId)) return false;
      if (filterTipe && t.tipe !== filterTipe) return false;
      if (filterDari && t.tanggal < filterDari) return false;
      if (filterSampai && t.tanggal > filterSampai) return false;
      return true;
    }).length,
    PENDING_APPROVAL: transaksiList.filter((t) => t.status === "PENDING_APPROVAL").length,
    APPROVED: transaksiList.filter((t) => t.status === "APPROVED").length,
    REJECTED: transaksiList.filter((t) => t.status === "REJECTED").length,
    VOID: transaksiList.filter((t) => t.status === "VOID").length,
  };

  return (
    <>
      <PageHeader
        title="Transaksi"
        description="Riwayat pergerakan alat perancah"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilter((v) => !v)}
              className={hasActiveFilter ? "border-blue-400 text-blue-600 bg-blue-50" : ""}
            >
              <Filter className="w-4 h-4 mr-1.5" />
              Filter
              {hasActiveFilter && (
                <span className="ml-1.5 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  aktif
                </span>
              )}
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setOpenCreate(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> Buat Transaksi
              </Button>
            )}
          </div>
        }
      />

      {/* Filter panel */}
      {showFilter && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-36 space-y-1">
            <label className="text-xs font-medium text-slate-500">Klien / Proyek</label>
            <select
              value={filterKlienId}
              onChange={(e) => setFilterKlienId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Semua klien</option>
              {klienList.map((k) => (
                <option key={k.id} value={k.id}>{k.kode} — {k.nama}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-36 space-y-1">
            <label className="text-xs font-medium text-slate-500">Alat</label>
            <select
              value={filterAlatId}
              onChange={(e) => setFilterAlatId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Semua alat</option>
              {alatList.map((a) => (
                <option key={a.id} value={a.id}>{a.kode} — {a.nama}</option>
              ))}
            </select>
          </div>
          <div className="min-w-36 space-y-1">
            <label className="text-xs font-medium text-slate-500">Tipe Transaksi</label>
            <select
              value={filterTipe}
              onChange={(e) => setFilterTipe(e.target.value as TipeTransaksi | "")}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Semua tipe</option>
              {TIPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{TIPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Tanggal dari</label>
            <input
              type="date"
              value={filterDari}
              onChange={(e) => setFilterDari(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Sampai</label>
            <input
              type="date"
              value={filterSampai}
              onChange={(e) => setFilterSampai(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-500 px-2 py-1.5"
            >
              <X className="w-4 h-4" /> Reset
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.value
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            {counts[tab.value] > 0 && (
              <span
                className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {counts[tab.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Tanggal</TableHead>
              <TableHead className="w-36">Tipe</TableHead>
              <TableHead>Klien</TableHead>
              <TableHead className="w-32">No. SJ</TableHead>
              <TableHead className="w-28 text-center">Status</TableHead>
              <TableHead className="w-28">Dibuat oleh</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-slate-400 text-sm">
                  Tidak ada transaksi{hasActiveFilter ? " (coba ubah filter)" : ""}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => router.push(`/transaksi/${t.id}`)}
                >
                  <TableCell className="text-sm">{formatDateShort(t.tanggal)}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPE_COLOR[t.tipe]}`}>
                      {TIPE_LABEL[t.tipe]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="text-slate-700">{t.klien?.kode ?? "—"}</span>
                    {t.klien_tujuan && (
                      <span className="text-slate-400"> → {t.klien_tujuan.kode}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{t.no_sj ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <TransaksiStatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {t.created_by_user?.nama ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {isAdmin && (
        <TransaksiFormDialog
          open={openCreate}
          onOpenChange={setOpenCreate}
          klienList={klienList}
          alatList={alatList}
          kontrakList={kontrakList}
        />
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { TransaksiStatusBadge } from "@/components/shared/status-badge";
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

type TransaksiPendingItem = {
  id: string;
  tipe: TipeTransaksi;
  tanggal: string;
  no_sj: string | null;
  created_at: string;
  klien: { kode: string; nama: string } | null;
  klien_tujuan: { kode: string; nama: string } | null;
  created_by_user: { nama: string } | null;
};

export function PendingClient({
  pendingList,
  isChecker,
}: {
  pendingList: TransaksiPendingItem[];
  isChecker: boolean;
}) {
  return (
    <>
      <PageHeader
        title="Menunggu Persetujuan"
        description={
          pendingList.length === 0
            ? "Semua transaksi sudah diproses"
            : `${pendingList.length} transaksi menunggu persetujuan`
        }
      />

      {isChecker && pendingList.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          Klik <strong>Detail</strong> untuk melihat item transaksi sebelum menyetujui atau menolak.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Tanggal</TableHead>
              <TableHead className="w-36">Tipe</TableHead>
              <TableHead>Klien</TableHead>
              <TableHead className="w-32">No. SJ</TableHead>
              <TableHead className="w-32">Dibuat oleh</TableHead>
              <TableHead className="w-24 text-center">Status</TableHead>
              <TableHead className="w-20 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingList.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12 text-slate-400 text-sm"
                >
                  Tidak ada transaksi yang menunggu persetujuan
                </TableCell>
              </TableRow>
            ) : (
              pendingList.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{formatDateShort(t.tanggal)}</TableCell>
                  <TableCell>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPE_COLOR[t.tipe]}`}
                    >
                      {TIPE_LABEL[t.tipe]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="text-slate-700">{t.klien?.kode ?? "—"}</span>
                    {t.klien_tujuan && (
                      <span className="text-slate-400"> → {t.klien_tujuan.kode}</span>
                    )}
                    {t.klien && (
                      <p className="text-xs text-slate-400">{t.klien.nama}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {t.no_sj ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {t.created_by_user?.nama ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <TransaksiStatusBadge status="PENDING_APPROVAL" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/transaksi/${t.id}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                        <Eye className="w-3 h-3" />
                        Detail
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

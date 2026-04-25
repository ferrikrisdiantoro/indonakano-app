"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, CheckSquare, Slash, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDateRange, formatRupiah } from "@/lib/utils";
import { finalizeTagihanAction, voidTagihanAction } from "../actions";
import type { TagihanStatus, SatuanTagihan } from "@/types/database";

const STATUS_CONFIG: Record<TagihanStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-amber-50 text-amber-700 border border-amber-200" },
  FINAL: { label: "Final", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  VOID: { label: "Void", className: "bg-slate-100 text-slate-500 border border-slate-200" },
};

type TagihanDetail = {
  id: string;
  nomor: string;
  status: TagihanStatus;
  periode_mulai: string;
  periode_akhir: string;
  override_periode: boolean;
  override_alasan: string | null;
  subtotal: number;
  ppn_persen: number;
  ppn_amount: number;
  total: number;
  void_reason: string | null;
  generated_at: string;
  finalized_at: string | null;
  klien: { kode: string; nama: string } | null;
  kontrak: { nomor_kontrak: string } | null;
  generated_by_user: { nama: string } | null;
  void_by_user: { nama: string } | null;
};

type TagihanItem = {
  id: string;
  alat_id: string;
  alat_nama: string;
  periode_teks: string;
  satuan: SatuanTagihan;
  qty: number;
  lama: number;
  harga_per_satuan_snapshot: number;
  total: number;
  ordering: number;
};

function VoidDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");
  function handleClose() { setReason(""); onOpenChange(false); }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Void Tagihan</DialogTitle></DialogHeader>
        <div className="space-y-1.5 pt-2">
          <Label>Alasan Void</Label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Jelaskan alasan void tagihan…"
            disabled={loading}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:opacity-50"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>Batal</Button>
          <Button
            variant="destructive"
            onClick={() => { if (reason.trim()) onConfirm(reason); }}
            disabled={loading || !reason.trim()}
          >
            {loading ? "Memvoid…" : "Void Tagihan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

export function TagihanDetailClient({
  tagihan,
  items,
  isAdmin,
}: {
  tagihan: TagihanDetail;
  items: TagihanItem[];
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [openFinalize, setOpenFinalize] = useState(false);
  const [openVoid, setOpenVoid] = useState(false);

  const isDraft = tagihan.status === "DRAFT";
  const isFinal = tagihan.status === "FINAL";
  const canFinalize = isAdmin && isDraft;
  const canVoid = isAdmin && (isDraft || isFinal);

  function handleFinalize() {
    startTransition(async () => {
      const result = await finalizeTagihanAction(tagihan.id);
      if (!result.success) toast.error(result.error);
      else {
        toast.success("Tagihan berhasil difinalisasi");
        setOpenFinalize(false);
      }
    });
  }

  function handleVoid(reason: string) {
    startTransition(async () => {
      const result = await voidTagihanAction(tagihan.id, reason);
      if (!result.success) toast.error(result.error);
      else {
        toast.success("Tagihan di-void");
        setOpenVoid(false);
      }
    });
  }

  const { label: statusLabel, className: statusClass } = STATUS_CONFIG[tagihan.status];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/tagihan"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
          >
            <ChevronLeft className="w-4 h-4" /> Kembali ke Tagihan
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold font-mono text-slate-900">
              {tagihan.nomor}
            </h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusClass}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Periode: {formatDateRange(tagihan.periode_mulai, tagihan.periode_akhir)}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <a href={`/print/tagihan/${tagihan.id}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <Printer className="w-4 h-4 mr-1.5" /> Cetak
            </Button>
          </a>
          {canFinalize && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setOpenFinalize(true)}
              disabled={isPending}
            >
              <CheckSquare className="w-4 h-4 mr-1.5" /> Finalisasi
            </Button>
          )}
          {canVoid && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenVoid(true)}
              disabled={isPending}
            >
              <Slash className="w-4 h-4 mr-1.5" /> Void
            </Button>
          )}
        </div>
      </div>

      {/* Alert banners */}
      {tagihan.status === "VOID" && tagihan.void_reason && (
        <div className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-xs font-medium text-slate-500 mb-0.5">Alasan Void</p>
          <p className="text-sm text-slate-700">{tagihan.void_reason}</p>
        </div>
      )}
      {tagihan.override_periode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-xs font-medium text-amber-700 mb-0.5">Override Periode</p>
          {tagihan.override_alasan && (
            <p className="text-sm text-amber-800">{tagihan.override_alasan}</p>
          )}
        </div>
      )}
      {isDraft && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          Tagihan ini masih berstatus <strong>Draft</strong>. Periksa item dan total sebelum finalisasi.
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {tagihan.klien && (
          <InfoCard label="Klien" value={`${tagihan.klien.kode} – ${tagihan.klien.nama}`} />
        )}
        {tagihan.kontrak && (
          <InfoCard label="Kontrak" value={tagihan.kontrak.nomor_kontrak} />
        )}
        {tagihan.generated_by_user && (
          <InfoCard
            label="Dibuat oleh"
            value={`${tagihan.generated_by_user.nama} · ${formatDate(tagihan.generated_at)}`}
          />
        )}
        {tagihan.finalized_at && (
          <InfoCard label="Difinalisasi" value={formatDate(tagihan.finalized_at)} />
        )}
        {tagihan.void_by_user && (
          <InfoCard label="Di-void oleh" value={tagihan.void_by_user.nama} />
        )}
      </div>

      {/* Items table — grouped by alat */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Rincian Tagihan ({items.length} baris)
        </h2>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Alat</TableHead>
                <TableHead className="w-12 text-right">Qty</TableHead>
                <TableHead className="w-16 text-center">Sat.</TableHead>
                <TableHead className="w-16 text-right">Lama</TableHead>
                <TableHead className="w-36 text-right">Harga/Sat.</TableHead>
                <TableHead className="w-36 text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                // Group items by alat_id preserving order of first occurrence
                const groups: { alat_id: string; alatNama: string; rows: TagihanItem[] }[] = [];
                const seen = new Map<string, number>();
                for (const item of items) {
                  if (!seen.has(item.alat_id)) {
                    seen.set(item.alat_id, groups.length);
                    groups.push({ alat_id: item.alat_id, alatNama: item.alat_nama, rows: [] });
                  }
                  groups[seen.get(item.alat_id)!].rows.push(item);
                }
                return groups.map((group) => {
                  const groupTotal = group.rows.reduce((s, r) => s + r.total, 0);
                  const multiRow = group.rows.length > 1;
                  return (
                    <>
                      {group.rows.map((item, ri) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm font-medium">
                            {ri === 0 ? item.alat_nama : (
                              <span className="text-slate-400 text-xs pl-3">↳ {item.alat_nama}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm">{item.qty}</TableCell>
                          <TableCell className="text-center text-sm text-slate-500">
                            {item.satuan}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {item.lama % 1 === 0 ? item.lama : item.lama.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatRupiah(item.harga_per_satuan_snapshot)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {formatRupiah(item.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {multiRow && (
                        <TableRow className="bg-slate-50 border-t border-slate-100">
                          <TableCell colSpan={5} className="text-xs text-slate-500 text-right pr-2 py-1.5">
                            Sub total {group.alatNama}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold text-slate-700 py-1.5">
                            {formatRupiah(groupTotal)}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                });
              })()}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-72 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium">{formatRupiah(tagihan.subtotal)}</span>
          </div>
          {tagihan.ppn_persen > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">PPN {tagihan.ppn_persen}%</span>
              <span className="font-medium">{formatRupiah(tagihan.ppn_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold border-t border-slate-200 pt-2 mt-2">
            <span>Total</span>
            <span className="text-slate-900">{formatRupiah(tagihan.total)}</span>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={openFinalize}
        onOpenChange={setOpenFinalize}
        title="Finalisasi Tagihan?"
        description={`Tagihan ${tagihan.nomor} akan berstatus FINAL. Setelah difinalisasi, tagihan tidak dapat diedit (hanya bisa di-void).`}
        confirmLabel="Finalisasi"
        variant="default"
        onConfirm={handleFinalize}
        loading={isPending}
      />
      <VoidDialog
        open={openVoid}
        onOpenChange={setOpenVoid}
        onConfirm={handleVoid}
        loading={isPending}
      />
    </div>
  );
}

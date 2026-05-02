"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, CheckCircle, XCircle, Slash, Pencil, Paperclip, Trash2, ExternalLink, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TransaksiStatusBadge } from "@/components/shared/status-badge";
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
import { formatDate, formatDateShort } from "@/lib/utils";
import {
  approveTransaksiAction,
  rejectTransaksiAction,
  voidTransaksiAction,
  saveAttachmentAction,
  deleteAttachmentAction,
} from "../../actions";
import {
  TransaksiFormDialog,
  type KlienOption,
  type AlatOption,
  type KontrakOption,
  type TransaksiInitialData,
} from "../../_components/transaksi-form";
import type { TipeTransaksi, TransaksiStatus } from "@/types/database";

const TIPE_LABEL: Record<TipeTransaksi, string> = {
  PENGIRIMAN: "Pengiriman",
  RETUR: "Retur",
  TRANSFER: "Transfer",
  CLAIM: "Claim",
  STOCK_ADJUSTMENT: "Penyesuaian Stok",
};

type TransaksiDetail = {
  id: string;
  tipe: TipeTransaksi;
  tanggal: string;
  klien_id: string | null;
  klien_tujuan_id: string | null;
  kontrak_id: string | null;
  no_sj: string | null;
  no_sj_operan: string | null;
  catatan: string | null;
  status: TransaksiStatus;
  override_stok_minus: boolean;
  override_alasan: string | null;
  created_by: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  void_at: string | null;
  void_reason: string | null;
  klien: { kode: string; nama: string } | null;
  klien_tujuan: { kode: string; nama: string } | null;
  kontrak: { nomor_kontrak: string } | null;
  created_by_user: { nama: string } | null;
  approved_by_user: { nama: string } | null;
  rejected_by_user: { nama: string } | null;
  void_by_user: { nama: string } | null;
  items: {
    id: string;
    alat_id: string;
    qty: number;
    alat: { kode: string; nama: string; satuan_default: string } | null;
  }[];
};

// ── Reject Dialog ─────────────────────────────────────────────

function RejectDialog({
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

  function handleClose() {
    setReason("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tolak Transaksi</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 pt-2">
          <Label>Alasan Penolakan</Label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Jelaskan alasan penolakan…"
            disabled={loading}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:opacity-50"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={() => { if (reason.trim()) onConfirm(reason); }}
            disabled={loading || !reason.trim()}
          >
            {loading ? "Menolak…" : "Tolak Transaksi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Void Dialog ───────────────────────────────────────────────

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

  function handleClose() {
    setReason("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Void Transaksi</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 pt-2">
          <Label>Alasan Void</Label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Jelaskan alasan void…"
            disabled={loading}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:opacity-50"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={() => { if (reason.trim()) onConfirm(reason); }}
            disabled={loading || !reason.trim()}
          >
            {loading ? "Memvoid…" : "Void Transaksi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Info Card ─────────────────────────────────────────────────

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────

type AttachmentRow = {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  uploaded_at: string;
};

export function TransaksiDetailClient({
  transaksi,
  currentUserId,
  isChecker,
  isAdmin,
  klienList,
  alatList,
  kontrakList,
  attachments: initialAttachments,
}: {
  transaksi: TransaksiDetail;
  currentUserId: string;
  isChecker: boolean;
  isAdmin: boolean;
  klienList: KlienOption[];
  alatList: AlatOption[];
  kontrakList: KontrakOption[];
  attachments: AttachmentRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [openApprove, setOpenApprove] = useState(false);
  const [openReject, setOpenReject] = useState(false);
  const [openVoid, setOpenVoid] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentRow[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isPendingStatus = transaksi.status === "PENDING_APPROVAL";
  const isOwnTransaksi = transaksi.created_by === currentUserId;
  // Both Admin & Checker bisa approve/reject, kecuali transaksi yang dia buat sendiri
  // (segregation of duties — ditegakkan juga di SQL function approve_transaksi)
  const canApproveReject = isPendingStatus && !isOwnTransaksi;
  const canVoid = isAdmin && isPendingStatus;
  // Both roles bisa edit transaksi PENDING (biasanya hanya creator yang akan edit, tapi role tidak membatasi)
  const canEdit = isPendingStatus;
  // Suppress unused warning — isChecker masih dilewati dari parent untuk masa depan (misal label UI)
  void isChecker;

  const editInitialData: TransaksiInitialData = {
    tipe: transaksi.tipe,
    tanggal: transaksi.tanggal,
    klien_id: transaksi.klien_id,
    klien_tujuan_id: transaksi.klien_tujuan_id,
    kontrak_id: transaksi.kontrak_id,
    no_sj: transaksi.no_sj,
    no_sj_operan: transaksi.no_sj_operan,
    catatan: transaksi.catatan,
    override_stok_minus: transaksi.override_stok_minus,
    override_alasan: transaksi.override_alasan,
    items: transaksi.items.map((i) => ({ alat_id: i.alat_id, qty: i.qty })),
  };

  function handleApprove() {
    startTransition(async () => {
      const result = await approveTransaksiAction(transaksi.id);
      if (!result.success) toast.error(result.error);
      else {
        toast.success("Transaksi berhasil disetujui");
        setOpenApprove(false);
      }
    });
  }

  function handleReject(reason: string) {
    startTransition(async () => {
      const result = await rejectTransaksiAction(transaksi.id, reason);
      if (!result.success) toast.error(result.error);
      else {
        toast.success("Transaksi ditolak");
        setOpenReject(false);
      }
    });
  }

  function handleVoid(reason: string) {
    startTransition(async () => {
      const result = await voidTransaksiAction(transaksi.id, reason);
      if (!result.success) toast.error(result.error);
      else {
        toast.success("Transaksi di-void");
        setOpenVoid(false);
      }
    });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileRef.current) fileRef.current = e.target;
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) { toast.error("Ukuran file maksimal 5 MB"); return; }
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type)) { toast.error("Format file harus PDF, JPG, atau PNG"); return; }

    setUploading(true);
    try {
      const supabase = createClient();
      const path = `${transaksi.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { data: uploaded, error: upErr } = await supabase.storage
        .from("transaksi-docs")
        .upload(path, file, { upsert: false });

      if (upErr) { toast.error(`Upload gagal: ${upErr.message}`); return; }

      const { data: { publicUrl } } = supabase.storage
        .from("transaksi-docs")
        .getPublicUrl(uploaded.path);

      const result = await saveAttachmentAction(transaksi.id, publicUrl, file.name, file.size);
      if (!result.success) { toast.error(result.error); return; }

      setAttachments((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          uploaded_at: new Date().toISOString(),
        },
      ]);
      toast.success("Dokumen berhasil diupload");
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAttachment(attachId: string) {
    const result = await deleteAttachmentAction(attachId, transaksi.id);
    if (!result.success) { toast.error(result.error); return; }
    setAttachments((prev) => prev.filter((a) => a.id !== attachId));
    toast.success("Dokumen dihapus");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/transaksi"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
          >
            <ChevronLeft className="w-4 h-4" /> Kembali ke Transaksi
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-900">
              {TIPE_LABEL[transaksi.tipe]}
            </h1>
            <TransaksiStatusBadge status={transaksi.status} />
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {formatDate(transaksi.tanggal)}
            {transaksi.no_sj && (
              <>
                {" "}· No. SJ:{" "}
                <span className="font-medium text-slate-700">{transaksi.no_sj}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenEdit(true)}
              disabled={isPending}
            >
              <Pencil className="w-4 h-4 mr-1.5" /> Edit
            </Button>
          )}
          {canApproveReject && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setOpenReject(true)}
                disabled={isPending}
              >
                <XCircle className="w-4 h-4 mr-1.5" /> Tolak
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setOpenApprove(true)}
                disabled={isPending}
              >
                <CheckCircle className="w-4 h-4 mr-1.5" /> Setujui
              </Button>
            </>
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
      {transaksi.status === "REJECTED" && transaksi.rejected_reason && (
        <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          <p className="text-xs font-medium text-red-600 mb-0.5">Alasan Penolakan</p>
          <p className="text-sm text-red-800">{transaksi.rejected_reason}</p>
        </div>
      )}
      {transaksi.status === "VOID" && transaksi.void_reason && (
        <div className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-xs font-medium text-slate-500 mb-0.5">Alasan Void</p>
          <p className="text-sm text-slate-700">{transaksi.void_reason}</p>
        </div>
      )}
      {transaksi.override_stok_minus && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-xs font-medium text-amber-700 mb-0.5">Override Stok Minus</p>
          {transaksi.override_alasan && (
            <p className="text-sm text-amber-800">{transaksi.override_alasan}</p>
          )}
        </div>
      )}
      {transaksi.catatan && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-xs font-medium text-slate-500 mb-0.5">Catatan</p>
          <p className="text-sm text-slate-700">{transaksi.catatan}</p>
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {transaksi.klien && (
          <InfoCard label="Klien" value={`${transaksi.klien.kode} – ${transaksi.klien.nama}`} />
        )}
        {transaksi.klien_tujuan && (
          <InfoCard
            label="Klien Tujuan"
            value={`${transaksi.klien_tujuan.kode} – ${transaksi.klien_tujuan.nama}`}
          />
        )}
        {transaksi.kontrak && (
          <InfoCard label="Kontrak" value={transaksi.kontrak.nomor_kontrak} />
        )}
        {transaksi.no_sj_operan && (
          <InfoCard label="No. SJ Operan" value={transaksi.no_sj_operan} />
        )}
        {transaksi.created_by_user && (
          <InfoCard label="Dibuat oleh" value={transaksi.created_by_user.nama} />
        )}
        {transaksi.approved_by_user && (
          <InfoCard
            label="Disetujui oleh"
            value={
              transaksi.approved_at
                ? `${transaksi.approved_by_user.nama} · ${formatDateShort(transaksi.approved_at)}`
                : transaksi.approved_by_user.nama
            }
          />
        )}
        {transaksi.rejected_by_user && (
          <InfoCard
            label="Ditolak oleh"
            value={
              transaksi.rejected_at
                ? `${transaksi.rejected_by_user.nama} · ${formatDateShort(transaksi.rejected_at)}`
                : transaksi.rejected_by_user.nama
            }
          />
        )}
        {transaksi.void_by_user && (
          <InfoCard
            label="Di-void oleh"
            value={
              transaksi.void_at
                ? `${transaksi.void_by_user.nama} · ${formatDateShort(transaksi.void_at)}`
                : transaksi.void_by_user.nama
            }
          />
        )}
      </div>

      {/* Items */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Daftar Alat ({transaksi.items.length} item)
        </h2>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Kode</TableHead>
                <TableHead>Nama Alat</TableHead>
                <TableHead className="w-24 text-right">Qty</TableHead>
                <TableHead className="w-20">Satuan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transaksi.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-slate-400 text-sm">
                    Tidak ada item
                  </TableCell>
                </TableRow>
              ) : (
                transaksi.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">
                      {item.alat?.kode ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{item.alat?.nama ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      {item.qty > 0 ? `+${item.qty}` : item.qty}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {item.alat?.satuan_default ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dokumen / Attachments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Paperclip className="w-4 h-4" /> Dokumen ({attachments.length})
          </h2>
          <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors border border-slate-200 hover:bg-slate-50 text-slate-600 ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            <Upload className="w-3.5 h-3.5" />
            {uploading ? "Mengupload…" : "Upload Dokumen"}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="sr-only"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>
        {attachments.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center">
            <p className="text-sm text-slate-400">Belum ada dokumen. Upload PDF/JPG/PNG (maks 5 MB).</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 truncate">{att.file_name}</p>
                    <p className="text-xs text-slate-400">
                      {(att.file_size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={att.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 p-1.5 rounded transition-colors"
                    title="Buka dokumen"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteAttachment(att.id)}
                      className="text-slate-400 hover:text-red-500 p-1.5 rounded transition-colors"
                      title="Hapus dokumen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={openApprove}
        onOpenChange={setOpenApprove}
        title="Setujui Transaksi?"
        description={`Stok akan diperbarui sesuai transaksi ${TIPE_LABEL[transaksi.tipe]}. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Setujui"
        variant="default"
        onConfirm={handleApprove}
        loading={isPending}
      />
      <RejectDialog
        open={openReject}
        onOpenChange={setOpenReject}
        onConfirm={handleReject}
        loading={isPending}
      />
      <VoidDialog
        open={openVoid}
        onOpenChange={setOpenVoid}
        onConfirm={handleVoid}
        loading={isPending}
      />
      <TransaksiFormDialog
        open={openEdit}
        onOpenChange={setOpenEdit}
        klienList={klienList}
        alatList={alatList}
        kontrakList={kontrakList}
        editId={transaksi.id}
        initialData={editInitialData}
      />
    </div>
  );
}

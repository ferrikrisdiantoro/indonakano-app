"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronLeft, Lock, Copy } from "lucide-react";
import type { AlatRow, KlienRow, KontrakSewaRow } from "@/types/database";
import { formatRupiah, calcHargaHarian } from "@/lib/utils";
import { formatDateShort } from "@/lib/utils";
import {
  upsertHargaSewaAction,
  deleteHargaSewaAction,
  updateKontrakDetailAction,
  duplicateKontrakAction,
} from "../actions";
import { KontrakStatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface HargaRow {
  id: string;
  alat_id: string;
  harga_bulanan: number;
  locked: boolean;
  alat: Pick<AlatRow, "kode" | "nama"> | null;
}

interface KontrakDetail extends KontrakSewaRow {
  klien: Pick<KlienRow, "kode" | "nama"> | null;
}

// ── Add/Edit Harga Dialog ─────────────────────────────────────

function HargaFormDialog({
  open,
  onOpenChange,
  kontrakId,
  alatList,
  existingAlatIds,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kontrakId: string;
  alatList: Pick<AlatRow, "id" | "kode" | "nama">[];
  existingAlatIds: Set<string>;
  editing: HargaRow | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [alatId, setAlatId] = useState(editing?.alat_id ?? "");
  const [harga, setHarga] = useState(editing ? String(editing.harga_bulanan) : "");

  const availableAlat = useMemo(() => {
    return alatList.filter(
      (a) => !existingAlatIds.has(a.id) || a.id === editing?.alat_id
    );
  }, [alatList, existingAlatIds, editing]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hargaNum = parseFloat(harga);
    if (!alatId || isNaN(hargaNum) || hargaNum < 0) {
      toast.error("Pilih alat dan isi harga yang valid");
      return;
    }

    startTransition(async () => {
      const result = await upsertHargaSewaAction(
        kontrakId,
        editing ? editing.alat_id : alatId,
        hargaNum
      );
      if (!result.success) toast.error(result.error);
      else {
        toast.success("Harga berhasil disimpan");
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Harga" : "Tambah Harga Alat"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Alat</Label>
            {editing ? (
              <p className="text-sm font-medium text-slate-800">
                {editing.alat?.nama ?? editing.alat_id}
              </p>
            ) : (
              <select
                value={alatId}
                onChange={(e) => setAlatId(e.target.value)}
                required
                disabled={isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Pilih alat…</option>
                {availableAlat.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.kode} — {a.nama}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Harga Bulanan (Rp)</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={harga}
              onChange={(e) => setHarga(e.target.value)}
              placeholder="0"
              required
              disabled={isPending}
            />
            {harga && !isNaN(parseFloat(harga)) && (
              <p className="text-xs text-slate-400">
                Harga/hari: Rp {calcHargaHarian(parseFloat(harga)).toLocaleString("id-ID", { maximumFractionDigits: 2 })}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Kontrak Info Dialog ──────────────────────────────────

function EditKontrakDialog({
  open,
  onOpenChange,
  kontrak,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kontrak: KontrakDetail;
}) {
  const [isPending, startTransition] = useTransition();
  const [nomor, setNomor] = useState(kontrak.nomor_kontrak);
  const [mulai, setMulai] = useState(kontrak.tanggal_mulai);
  const [selesai, setSelesai] = useState(kontrak.tanggal_selesai ?? "");
  const [tutup, setTutup] = useState(
    kontrak.tgl_tutup_periode_default ? String(kontrak.tgl_tutup_periode_default) : ""
  );
  const [ppn, setPpn] = useState(kontrak.apply_ppn);
  const [status, setStatus] = useState<"AKTIF" | "SELESAI" | "DIBATALKAN">(kontrak.status);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateKontrakDetailAction(kontrak.id, {
        nomor_kontrak: nomor,
        tanggal_mulai: mulai,
        tanggal_selesai: selesai,
        tgl_tutup_periode_default: tutup,
        apply_ppn: ppn,
        status,
      });
      if (!result.success) toast.error(result.error);
      else {
        toast.success("Kontrak berhasil diperbarui");
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Kontrak Sewa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nomor Kontrak</Label>
            <Input value={nomor} onChange={(e) => setNomor(e.target.value)} required disabled={isPending} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tanggal Mulai</Label>
              <Input type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} required disabled={isPending} />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Selesai <span className="text-slate-400 font-normal">(opsional)</span></Label>
              <Input type="date" value={selesai} onChange={(e) => setSelesai(e.target.value)} disabled={isPending} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tgl Tutup Periode</Label>
              <Input type="number" min={1} max={31} value={tutup} onChange={(e) => setTutup(e.target.value)} placeholder="kosong = akhir bulan" disabled={isPending} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                disabled={isPending}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="AKTIF">Aktif</option>
                <option value="SELESAI">Selesai</option>
                <option value="DIBATALKAN">Dibatalkan</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={ppn} onChange={(e) => setPpn(e.target.checked)} disabled={isPending} className="rounded border-slate-300" />
            <span className="text-sm font-medium text-slate-700">Terapkan PPN 11%</span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Batal</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Menyimpan…" : "Simpan"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Duplicate Kontrak Dialog ──────────────────────────────────

function DuplicateKontrakDialog({
  open,
  onOpenChange,
  kontrakId,
  sourceNomor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kontrakId: string;
  sourceNomor: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nomor, setNomor] = useState(`${sourceNomor}-COPY`);
  const [mulai, setMulai] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nomor.trim() || !mulai) return;
    startTransition(async () => {
      const result = await duplicateKontrakAction(kontrakId, nomor, mulai);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Kontrak berhasil diduplikasi");
      onOpenChange(false);
      router.push(`/master/kontrak/${result.newId}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Duplikasi Kontrak</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500 -mt-1">
          Membuat kontrak baru berdasarkan <span className="font-medium">{sourceNomor}</span> beserta seluruh harga sewanya.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Nomor Kontrak Baru</Label>
            <Input
              value={nomor}
              onChange={(e) => setNomor(e.target.value)}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tanggal Mulai</Label>
            <Input
              type="date"
              value={mulai}
              onChange={(e) => setMulai(e.target.value)}
              required
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menduplikasi…" : "Duplikasi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────

export function KontrakDetailClient({
  kontrak,
  hargaList,
  alatList,
}: {
  kontrak: KontrakDetail;
  hargaList: HargaRow[];
  alatList: Pick<AlatRow, "id" | "kode" | "nama">[];
}) {
  const [isPending, startTransition] = useTransition();
  const [openAdd, setOpenAdd] = useState(false);
  const [editingHarga, setEditingHarga] = useState<HargaRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HargaRow | null>(null);
  const [openEditKontrak, setOpenEditKontrak] = useState(false);
  const [openDuplicate, setOpenDuplicate] = useState(false);

  const existingAlatIds = useMemo(
    () => new Set(hargaList.map((h) => h.alat_id)),
    [hargaList]
  );

  const allLocked = hargaList.length > 0 && hargaList.every((h) => h.locked);
  const totalHarga = hargaList.reduce((s, h) => s + h.harga_bulanan, 0);

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteHargaSewaAction(kontrak.id, deleteTarget.id);
      if (!result.success) toast.error(result.error);
      else toast.success("Harga dihapus");
      setDeleteTarget(null);
    });
  }

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link
          href="/master/kontrak"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-3"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Daftar Kontrak
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-semibold text-slate-900">
                {kontrak.nomor_kontrak}
              </h1>
              <KontrakStatusBadge status={kontrak.status} />
            </div>
            <p className="text-sm text-slate-500">
              {kontrak.klien?.nama} ({kontrak.klien?.kode}) ·{" "}
              {formatDateShort(kontrak.tanggal_mulai)} –{" "}
              {kontrak.tanggal_selesai ? formatDateShort(kontrak.tanggal_selesai) : "Open"} ·
              PPN {kontrak.apply_ppn ? "11%" : "Tidak"} ·
              Tutup tgl {kontrak.tgl_tutup_periode_default ?? "Akhir bulan"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpenDuplicate(true)}>
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Duplikasi
            </Button>
            <Button variant="outline" size="sm" onClick={() => setOpenEditKontrak(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              Edit Kontrak
            </Button>
          </div>
        </div>
      </div>

      {/* Harga sewa section */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Harga Sewa per Alat</h2>
            {allLocked && (
              <p className="text-xs text-orange-600 flex items-center gap-1 mt-0.5">
                <Lock className="w-3 h-3" />
                Semua harga terkunci (sudah ada transaksi disetujui)
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hargaList.length > 0 && (
              <span className="text-xs text-slate-500">
                {hargaList.length} alat · Total/bln: {formatRupiah(totalHarga)}
              </span>
            )}
            <Button
              size="sm"
              onClick={() => { setEditingHarga(null); setOpenAdd(true); }}
              disabled={alatList.length === existingAlatIds.size}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Tambah Harga
            </Button>
          </div>
        </div>

        {hargaList.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-slate-400 mb-3">
              Belum ada harga alat. Tambahkan harga untuk setiap alat yang disewa.
            </p>
            <Button size="sm" onClick={() => setOpenAdd(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Tambah Harga
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Kode</TableHead>
                <TableHead>Nama Alat</TableHead>
                <TableHead className="w-36 text-right">Harga/Bulan</TableHead>
                <TableHead className="w-32 text-right">Harga/Hari</TableHead>
                <TableHead className="w-20 text-center">Status</TableHead>
                <TableHead className="w-20 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hargaList.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-mono text-xs">{h.alat?.kode ?? "—"}</TableCell>
                  <TableCell className="font-medium">{h.alat?.nama ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatRupiah(h.harga_bulanan)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-500">
                    {calcHargaHarian(h.harga_bulanan).toLocaleString("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-center">
                    {h.locked ? (
                      <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
                        <Lock className="w-3 h-3" /> Terkunci
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Dapat edit</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Edit harga"
                        disabled={h.locked}
                        onClick={() => { setEditingHarga(h); setOpenAdd(true); }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                        title="Hapus harga"
                        disabled={h.locked}
                        onClick={() => setDeleteTarget(h)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialogs */}
      {openAdd && (
        <HargaFormDialog
          open={openAdd}
          onOpenChange={(v) => { setOpenAdd(v); if (!v) setEditingHarga(null); }}
          kontrakId={kontrak.id}
          alatList={alatList}
          existingAlatIds={existingAlatIds}
          editing={editingHarga}
        />
      )}

      {openEditKontrak && (
        <EditKontrakDialog
          open={openEditKontrak}
          onOpenChange={setOpenEditKontrak}
          kontrak={kontrak}
        />
      )}

      {openDuplicate && (
        <DuplicateKontrakDialog
          open={openDuplicate}
          onOpenChange={setOpenDuplicate}
          kontrakId={kontrak.id}
          sourceNomor={kontrak.nomor_kontrak}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Hapus Harga Alat?"
        description={`Harga untuk "${deleteTarget?.alat?.nama}" akan dihapus dari kontrak ini.`}
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={handleDelete}
        loading={isPending}
      />
    </div>
  );
}

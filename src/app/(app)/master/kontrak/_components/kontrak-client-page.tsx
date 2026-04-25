"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Eye, Copy, Search } from "lucide-react";
import type { KlienRow, KontrakSewaRow, KontrakStatus } from "@/types/database";
import {
  createKontrakAction,
  duplicateKontrakAction,
  type KontrakFormData,
} from "../actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
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
import { formatDateShort } from "@/lib/utils";

interface KontrakWithKlien extends KontrakSewaRow {
  klien: Pick<KlienRow, "kode" | "nama"> | null;
}

// ── Create Kontrak Dialog ─────────────────────────────────────

function KontrakCreateDialog({
  open,
  onOpenChange,
  klienList,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  klienList: Pick<KlienRow, "id" | "kode" | "nama">[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [klienId, setKlienId] = useState("");
  const [nomorKontrak, setNomorKontrak] = useState("");
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [tutupPeriode, setTutupPeriode] = useState("");
  const [applyPpn, setApplyPpn] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data: KontrakFormData = {
      klien_id: klienId,
      nomor_kontrak: nomorKontrak,
      tanggal_mulai: tanggalMulai,
      tanggal_selesai: tanggalSelesai,
      tgl_tutup_periode_default: tutupPeriode,
      apply_ppn: applyPpn,
    };

    startTransition(async () => {
      const result = await createKontrakAction(data);
      if (!result.success) {
        toast.error(result.error);
      } else {
        toast.success("Kontrak berhasil dibuat");
        onOpenChange(false);
        if (result.id) router.push(`/master/kontrak/${result.id}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Buat Kontrak Sewa Baru</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Klien</Label>
            <select
              value={klienId}
              onChange={(e) => setKlienId(e.target.value)}
              required
              disabled={isPending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Pilih klien…</option>
              {klienList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.kode} — {k.nama}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Nomor Kontrak</Label>
            <Input
              value={nomorKontrak}
              onChange={(e) => setNomorKontrak(e.target.value)}
              placeholder="PKS/2026/001"
              required
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tanggal Mulai</Label>
              <Input
                type="date"
                value={tanggalMulai}
                onChange={(e) => setTanggalMulai(e.target.value)}
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Tanggal Selesai{" "}
                <span className="text-slate-400 font-normal">(opsional)</span>
              </Label>
              <Input
                type="date"
                value={tanggalSelesai}
                onChange={(e) => setTanggalSelesai(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Tanggal Tutup Periode Default{" "}
              <span className="text-slate-400 font-normal">(opsional, 1-31)</span>
            </Label>
            <Input
              type="number"
              min={1}
              max={31}
              value={tutupPeriode}
              onChange={(e) => setTutupPeriode(e.target.value)}
              placeholder="25 = INDONAKANO, kosong = akhir bulan"
              disabled={isPending}
            />
            <p className="text-xs text-slate-400">
              25 untuk siklus INDONAKANO (26–25). Kosong = akhir bulan.
            </p>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={applyPpn}
              onChange={(e) => setApplyPpn(e.target.checked)}
              disabled={isPending}
              className="rounded border-slate-300"
            />
            <span className="text-sm font-medium text-slate-700">
              Terapkan PPN 11%
            </span>
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Membuat…" : "Buat & Atur Harga →"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────

export function KontrakClientPage({
  data,
  klienList,
}: {
  data: KontrakWithKlien[];
  klienList: Pick<KlienRow, "id" | "kode" | "nama">[];
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState<KontrakWithKlien | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<KontrakStatus | "">("");

  const filtered = useMemo(() => {
    return data.filter((k) => {
      if (filterStatus && k.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          k.nomor_kontrak.toLowerCase().includes(q) ||
          k.klien?.nama.toLowerCase().includes(q) ||
          k.klien?.kode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, search, filterStatus]);

  function handleDuplicate() {
    if (!confirmDuplicate) return;
    startTransition(async () => {
      const result = await duplicateKontrakAction(confirmDuplicate.id);
      if (!result.success) toast.error(result.error);
      setConfirmDuplicate(null);
    });
  }

  return (
    <>
      <PageHeader
        title="Kontrak Sewa"
        description={`${data.filter((k) => k.status === "AKTIF").length} kontrak aktif`}
        action={
          <Button onClick={() => setOpen(true)} size="sm" disabled={klienList.length === 0}>
            <Plus className="w-4 h-4 mr-1.5" />
            Buat Kontrak
          </Button>
        }
      />

      {klienList.length === 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Tambahkan klien di Master Klien terlebih dahulu sebelum membuat kontrak.
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kontrak atau klien…"
            className="pl-8 h-8 text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as KontrakStatus | "")}
          className="h-8 rounded-md border border-input bg-background px-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Semua status</option>
          <option value="AKTIF">Aktif</option>
          <option value="SELESAI">Selesai</option>
          <option value="DIBATALKAN">Dibatalkan</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            message="Belum ada kontrak"
            action={
              <Button onClick={() => setOpen(true)} size="sm" disabled={klienList.length === 0}>
                <Plus className="w-4 h-4 mr-1.5" />
                Buat Kontrak
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Klien</TableHead>
                <TableHead>No. Kontrak</TableHead>
                <TableHead className="w-28">Mulai</TableHead>
                <TableHead className="w-28">Selesai</TableHead>
                <TableHead className="w-16 text-center">Tgl Tutup</TableHead>
                <TableHead className="w-14 text-center">PPN</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-20 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((k) => (
                <TableRow key={k.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{k.klien?.nama ?? "—"}</p>
                      <p className="text-xs text-slate-400 font-mono">{k.klien?.kode}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-medium">
                    {k.nomor_kontrak}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {formatDateShort(k.tanggal_mulai)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {k.tanggal_selesai ? formatDateShort(k.tanggal_selesai) : "Open"}
                  </TableCell>
                  <TableCell className="text-center text-sm text-slate-600">
                    {k.tgl_tutup_periode_default ?? "Akhir Bln"}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-xs font-medium ${k.apply_ppn ? "text-emerald-600" : "text-slate-400"}`}>
                      {k.apply_ppn ? "Ya" : "Tidak"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <KontrakStatusBadge status={k.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Lihat Detail & Harga"
                        asChild
                      >
                        <a href={`/master/kontrak/${k.id}`}>
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Duplikat Kontrak"
                        onClick={() => setConfirmDuplicate(k)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <KontrakCreateDialog
        open={open}
        onOpenChange={setOpen}
        klienList={klienList}
      />

      <ConfirmDialog
        open={!!confirmDuplicate}
        onOpenChange={(v) => !v && setConfirmDuplicate(null)}
        title="Duplikat Kontrak?"
        description={`Kontrak "${confirmDuplicate?.nomor_kontrak}" akan diduplikat dengan semua harga sewa (unlocked). Anda perlu edit tanggal dan nomor kontrak di detail kontrak baru.`}
        confirmLabel="Duplikat"
        variant="default"
        onConfirm={handleDuplicate}
        loading={isPending}
      />
    </>
  );
}

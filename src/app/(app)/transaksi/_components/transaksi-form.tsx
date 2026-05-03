"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createTransaksiAction, editTransaksiAction } from "../actions";
import type { TipeTransaksi } from "@/types/database";

const TIPE_OPTIONS: { value: TipeTransaksi; label: string }[] = [
  { value: "PENGIRIMAN", label: "Pengiriman" },
  { value: "RETUR", label: "Retur" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "CLAIM", label: "Claim" },
  { value: "STOCK_ADJUSTMENT", label: "Penyesuaian Stok" },
];

export type KlienOption = { id: string; kode: string; nama: string };
export type AlatOption = { id: string; kode: string; nama: string; satuan_default: string };
export type KontrakOption = { id: string; klien_id: string; nomor_kontrak: string };

export type TransaksiInitialData = {
  tipe: TipeTransaksi;
  tanggal: string;
  klien_id: string | null;
  klien_tujuan_id: string | null;
  kontrak_id: string | null;
  no_sj: string | null;
  no_sj_operan: string | null;
  catatan: string | null;
  override_stok_minus: boolean;
  override_alasan: string | null;
  items: { alat_id: string; qty: number }[];
};

type ItemRow = { key: number; alat_id: string; qty: string };

export function TransaksiFormDialog({
  open,
  onOpenChange,
  klienList,
  alatList,
  kontrakList,
  editId,
  initialData,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  klienList: KlienOption[];
  alatList: AlatOption[];
  kontrakList: KontrakOption[];
  editId?: string;
  initialData?: TransaksiInitialData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tipe, setTipe] = useState<TipeTransaksi>("PENGIRIMAN");
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [klienId, setKlienId] = useState("");
  const [klienTujuanId, setKlienTujuanId] = useState("");
  const [kontrakId, setKontrakId] = useState("");
  const [noSj, setNoSj] = useState("");
  const [noSjOperan, setNoSjOperan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [overrideStokMinus, setOverrideStokMinus] = useState(false);
  const [overrideAlasan, setOverrideAlasan] = useState("");
  const [itemRows, setItemRows] = useState<ItemRow[]>([{ key: 0, alat_id: "", qty: "" }]);
  const [nextKey, setNextKey] = useState(1);

  // Populate from initialData when opening in edit mode
  useEffect(() => {
    if (open && editId && initialData) {
      setTipe(initialData.tipe);
      setTanggal(initialData.tanggal);
      setKlienId(initialData.klien_id ?? "");
      setKlienTujuanId(initialData.klien_tujuan_id ?? "");
      setKontrakId(initialData.kontrak_id ?? "");
      setNoSj(initialData.no_sj ?? "");
      setNoSjOperan(initialData.no_sj_operan ?? "");
      setCatatan(initialData.catatan ?? "");
      setOverrideStokMinus(initialData.override_stok_minus);
      setOverrideAlasan(initialData.override_alasan ?? "");
      const rows = initialData.items.map((item, i) => ({
        key: i,
        alat_id: item.alat_id,
        qty: item.qty.toString(),
      }));
      setItemRows(rows.length ? rows : [{ key: 0, alat_id: "", qty: "" }]);
      setNextKey(initialData.items.length + 1);
    } else if (!open) {
      setTipe("PENGIRIMAN");
      setTanggal(new Date().toISOString().split("T")[0]);
      setKlienId("");
      setKlienTujuanId("");
      setKontrakId("");
      setNoSj("");
      setNoSjOperan("");
      setCatatan("");
      setOverrideStokMinus(false);
      setOverrideAlasan("");
      setItemRows([{ key: 0, alat_id: "", qty: "" }]);
      setNextKey(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-fill active contract when klien changes (create mode only)
  useEffect(() => {
    if (editId) return; // skip auto-fill in edit mode
    if (klienId) {
      const match = kontrakList.find((k) => k.klien_id === klienId);
      setKontrakId(match?.id ?? "");
    } else {
      setKontrakId("");
    }
  }, [klienId, kontrakList, editId]);

  const handleTipeChange = useCallback((newTipe: TipeTransaksi) => {
    setTipe(newTipe);
    if (newTipe === "STOCK_ADJUSTMENT") {
      setKlienId("");
      setKlienTujuanId("");
      setKontrakId("");
    } else if (newTipe !== "TRANSFER") {
      setKlienTujuanId("");
    }
  }, []);

  function addItem() {
    setItemRows((prev) => [...prev, { key: nextKey, alat_id: "", qty: "" }]);
    setNextKey((k) => k + 1);
  }

  function updateItem(key: number, field: "alat_id" | "qty", value: string) {
    setItemRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  }

  function removeItem(key: number) {
    setItemRows((prev) => prev.filter((r) => r.key !== key));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (requiresNoSj && !noSj.trim()) {
      toast.error("No. Surat Jalan wajib diisi untuk tipe ini");
      return;
    }
    if (tipe === "TRANSFER" && !noSjOperan.trim()) {
      toast.error("No. SJ Operan wajib diisi untuk Transfer");
      return;
    }

    const items = itemRows
      .filter((r) => r.alat_id && r.qty)
      .map((r) => ({ alat_id: r.alat_id, qty: parseInt(r.qty) }));

    const formData = {
      tipe,
      tanggal,
      klien_id: tipe !== "STOCK_ADJUSTMENT" ? klienId || null : null,
      klien_tujuan_id: tipe === "TRANSFER" ? klienTujuanId || null : null,
      kontrak_id: kontrakId || null,
      no_sj: noSj,
      no_sj_operan: noSjOperan,
      catatan,
      override_stok_minus: overrideStokMinus,
      override_alasan: overrideAlasan,
      items,
    };

    startTransition(async () => {
      const result = editId
        ? await editTransaksiAction(editId, formData)
        : await createTransaksiAction(formData);

      if (!result.success) {
        toast.error(result.error);
      } else {
        toast.success(editId ? "Transaksi berhasil diperbarui" : "Transaksi dibuat, menunggu persetujuan");
        onOpenChange(false);
        if (!editId && result.id) router.push(`/transaksi/${result.id}`);
      }
    });
  }

  const showKlien = tipe !== "STOCK_ADJUSTMENT";
  const showKlienTujuan = tipe === "TRANSFER";
  const showNoSjOperan = tipe === "TRANSFER";
  const isAdjustment = tipe === "STOCK_ADJUSTMENT";
  const requiresNoSj = tipe === "PENGIRIMAN" || tipe === "RETUR" || tipe === "TRANSFER";

  const selectCls =
    "w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editId ? "Edit Transaksi" : "Buat Transaksi Baru"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 space-y-4 pr-1 py-2">

            {/* Tipe & Tanggal */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipe Transaksi</Label>
                <select
                  value={tipe}
                  onChange={(e) => handleTipeChange(e.target.value as TipeTransaksi)}
                  disabled={isPending}
                  className={selectCls}
                >
                  {TIPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal</Label>
                <Input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  required
                  disabled={isPending}
                />
              </div>
            </div>

            {/* Klien */}
            {showKlien && (
              <div className={showKlienTujuan ? "grid grid-cols-2 gap-3" : ""}>
                <div className="space-y-1.5">
                  <Label>Klien <span className="text-red-500">*</span></Label>
                  <select
                    value={klienId}
                    onChange={(e) => setKlienId(e.target.value)}
                    required
                    disabled={isPending}
                    className={selectCls}
                  >
                    <option value="">— Pilih Klien —</option>
                    {klienList.map((k) => (
                      <option key={k.id} value={k.id}>{k.kode} – {k.nama}</option>
                    ))}
                  </select>
                </div>
                {showKlienTujuan && (
                  <div className="space-y-1.5">
                    <Label>Klien Tujuan <span className="text-red-500">*</span></Label>
                    <select
                      value={klienTujuanId}
                      onChange={(e) => setKlienTujuanId(e.target.value)}
                      required
                      disabled={isPending}
                      className={selectCls}
                    >
                      <option value="">— Pilih Klien Tujuan —</option>
                      {klienList
                        .filter((k) => k.id !== klienId)
                        .map((k) => (
                          <option key={k.id} value={k.id}>{k.kode} – {k.nama}</option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Kontrak */}
            {showKlien && (
              <div className="space-y-1.5">
                <Label>Kontrak <span className="text-slate-400 text-xs">(opsional)</span></Label>
                <select
                  value={kontrakId}
                  onChange={(e) => setKontrakId(e.target.value)}
                  disabled={isPending}
                  className={selectCls}
                >
                  <option value="">— Tanpa Kontrak —</option>
                  {kontrakList
                    .filter((k) => !klienId || k.klien_id === klienId)
                    .map((k) => (
                      <option key={k.id} value={k.id}>{k.nomor_kontrak}</option>
                    ))}
                </select>
              </div>
            )}

            {/* No SJ */}
            <div className={showNoSjOperan ? "grid grid-cols-2 gap-3" : ""}>
              <div className="space-y-1.5">
                <Label>
                  No. Surat Jalan{" "}
                  {requiresNoSj ? (
                    <span className="text-red-500">*</span>
                  ) : (
                    <span className="text-slate-400 text-xs">(opsional)</span>
                  )}
                </Label>
                <Input
                  value={noSj}
                  onChange={(e) => setNoSj(e.target.value)}
                  placeholder="Contoh: SJ-001"
                  disabled={isPending}
                />
              </div>
              {showNoSjOperan && (
                <div className="space-y-1.5">
                  <Label>
                    No. SJ Operan <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={noSjOperan}
                    onChange={(e) => setNoSjOperan(e.target.value)}
                    placeholder="Contoh: SJ-002"
                    disabled={isPending}
                  />
                </div>
              )}
            </div>

            {/* Catatan */}
            <div className="space-y-1.5">
              <Label>Catatan</Label>
              <textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                rows={2}
                disabled={isPending}
                placeholder="Catatan tambahan (opsional)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:opacity-50"
              />
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Daftar Alat <span className="text-red-500">*</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                  disabled={isPending}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Baris
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alat</TableHead>
                      <TableHead className="w-28">
                        {isAdjustment ? "Qty (+/−)" : "Qty"}
                      </TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemRows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="py-1.5">
                          <select
                            value={row.alat_id}
                            onChange={(e) => updateItem(row.key, "alat_id", e.target.value)}
                            required
                            disabled={isPending}
                            className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                          >
                            <option value="">— Pilih Alat —</option>
                            {alatList.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.kode} – {a.nama}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input
                            type="number"
                            value={row.qty}
                            onChange={(e) => updateItem(row.key, "qty", e.target.value)}
                            required
                            min={isAdjustment ? undefined : 1}
                            placeholder={isAdjustment ? "±0" : "1"}
                            disabled={isPending}
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeItem(row.key)}
                            disabled={isPending || itemRows.length === 1}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {isAdjustment ? (
                <p className="text-xs text-slate-500">
                  Isi qty <span className="font-semibold text-emerald-600">positif (mis. 10)</span> untuk
                  menambah stok gudang, atau <span className="font-semibold text-red-600">negatif (mis. -3)</span> untuk
                  mengurangi.
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Selalu isi qty positif. Arah pergerakan stok mengikuti tipe transaksi:{" "}
                  {tipe === "PENGIRIMAN" && <><span className="font-semibold text-red-600">keluar gudang → masuk proyek</span>.</>}
                  {tipe === "RETUR" && <><span className="font-semibold text-emerald-600">masuk gudang ← keluar proyek</span>.</>}
                  {tipe === "TRANSFER" && <><span className="font-semibold text-blue-600">pindah dari proyek asal → proyek tujuan</span>.</>}
                  {tipe === "CLAIM" && <><span className="font-semibold text-amber-600">stok proyek berkurang (alat hilang/rusak)</span>.</>}
                </p>
              )}
            </div>

            {/* Override */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overrideStokMinus}
                  onChange={(e) => setOverrideStokMinus(e.target.checked)}
                  disabled={isPending}
                  className="rounded border-input"
                />
                <span className="text-sm text-slate-600">
                  Override stok minus (stok gudang boleh negatif)
                </span>
              </label>
              {overrideStokMinus && (
                <div className="space-y-1.5">
                  <Label>Alasan Override</Label>
                  <Input
                    value={overrideAlasan}
                    onChange={(e) => setOverrideAlasan(e.target.value)}
                    placeholder="Jelaskan alasan override stok minus"
                    disabled={isPending}
                    required={overrideStokMinus}
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t mt-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? editId ? "Menyimpan…" : "Membuat…"
                : editId ? "Simpan Perubahan" : "Buat Transaksi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

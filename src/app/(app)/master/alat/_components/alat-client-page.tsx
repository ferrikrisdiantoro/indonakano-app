"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Power, Search } from "lucide-react";
import type { AlatRow } from "@/types/database";
import {
  createAlatAction,
  updateAlatAction,
  toggleAlatActiveAction,
  type AlatFormData,
} from "../actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
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

// ── Form Dialog ───────────────────────────────────────────────

function AlatFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: AlatRow | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [kode, setKode] = useState(editing?.kode ?? "");
  const [nama, setNama] = useState(editing?.nama ?? "");
  const [satuan, setSatuan] = useState(editing?.satuan_default ?? "unit");

  // Sync fields when editing changes
  useState(() => {
    setKode(editing?.kode ?? "");
    setNama(editing?.nama ?? "");
    setSatuan(editing?.satuan_default ?? "unit");
  });

  function handleOpenChange(v: boolean) {
    if (!v) {
      setKode(editing?.kode ?? "");
      setNama(editing?.nama ?? "");
      setSatuan(editing?.satuan_default ?? "unit");
    }
    onOpenChange(v);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data: AlatFormData = { kode, nama, satuan_default: satuan };

    startTransition(async () => {
      const result = editing
        ? await updateAlatAction(editing.id, data)
        : await createAlatAction(data);

      if (!result.success) {
        toast.error(result.error);
      } else {
        toast.success(editing ? "Alat berhasil diperbarui" : "Alat berhasil ditambahkan");
        handleOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Alat" : "Tambah Alat"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="kode">Kode Alat</Label>
            <Input
              id="kode"
              value={kode}
              onChange={(e) => setKode(e.target.value.toUpperCase())}
              placeholder="MF-170"
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nama">Nama Alat</Label>
            <Input
              id="nama"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Main Frame 170"
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="satuan">Satuan Default</Label>
            <Input
              id="satuan"
              value={satuan}
              onChange={(e) => setSatuan(e.target.value)}
              placeholder="unit"
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
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

// ── Main Component ────────────────────────────────────────────

export function AlatClientPage({ data }: { data: AlatRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AlatRow | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<AlatRow | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const filtered = useMemo(() => {
    return data.filter((a) => {
      if (!showInactive && !a.is_active) return false;
      if (search) {
        const q = search.toLowerCase();
        return a.kode.toLowerCase().includes(q) || a.nama.toLowerCase().includes(q);
      }
      return true;
    });
  }, [data, search, showInactive]);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(row: AlatRow) {
    setEditing(row);
    setOpen(true);
  }

  function handleToggle() {
    if (!confirmToggle) return;
    startTransition(async () => {
      const result = await toggleAlatActiveAction(
        confirmToggle.id,
        !confirmToggle.is_active
      );
      if (!result.success) toast.error(result.error);
      else
        toast.success(
          confirmToggle.is_active ? "Alat dinonaktifkan" : "Alat diaktifkan"
        );
      setConfirmToggle(null);
    });
  }

  return (
    <>
      <PageHeader
        title="Master Alat"
        description={`${data.filter((a) => a.is_active).length} alat aktif`}
        action={
          <Button onClick={openCreate} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Tambah Alat
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode atau nama…"
            className="pl-8 h-8 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-slate-300"
          />
          Tampilkan nonaktif
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            message="Belum ada alat"
            description="Klik Tambah Alat untuk menambahkan data"
            action={
              <Button onClick={openCreate} size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                Tambah Alat
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Kode</TableHead>
                <TableHead>Nama Alat</TableHead>
                <TableHead className="w-24">Satuan</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-20 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((alat) => (
                <TableRow key={alat.id} className={!alat.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-xs font-medium">
                    {alat.kode}
                  </TableCell>
                  <TableCell className="font-medium">{alat.nama}</TableCell>
                  <TableCell className="text-slate-500">{alat.satuan_default}</TableCell>
                  <TableCell>
                    <StatusBadge active={alat.is_active} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Edit"
                        onClick={() => openEdit(alat)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={alat.is_active ? "Nonaktifkan" : "Aktifkan"}
                        onClick={() => setConfirmToggle(alat)}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Form dialog */}
      {open && (
        <AlatFormDialog
          open={open}
          onOpenChange={setOpen}
          editing={editing}
        />
      )}

      {/* Toggle confirm */}
      <ConfirmDialog
        open={!!confirmToggle}
        onOpenChange={(v) => !v && setConfirmToggle(null)}
        title={confirmToggle?.is_active ? "Nonaktifkan Alat?" : "Aktifkan Alat?"}
        description={
          confirmToggle?.is_active
            ? `Alat "${confirmToggle?.nama}" akan dinonaktifkan dan tidak muncul di pilihan transaksi baru.`
            : `Alat "${confirmToggle?.nama}" akan diaktifkan kembali.`
        }
        confirmLabel={confirmToggle?.is_active ? "Nonaktifkan" : "Aktifkan"}
        variant={confirmToggle?.is_active ? "destructive" : "default"}
        onConfirm={handleToggle}
        loading={isPending}
      />
    </>
  );
}

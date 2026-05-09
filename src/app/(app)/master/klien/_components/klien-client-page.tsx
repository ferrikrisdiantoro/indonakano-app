"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Power, Search } from "lucide-react";
import type { KlienRow } from "@/types/database";
import {
  createKlienAction,
  updateKlienAction,
  toggleKlienActiveAction,
  type KlienFormData,
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

function KlienFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: KlienRow | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [kode, setKode] = useState(editing?.kode ?? "");
  const [nama, setNama] = useState(editing?.nama ?? "");
  const [pic, setPic] = useState(editing?.pic_nama ?? "");
  const [kontak, setKontak] = useState(editing?.pic_kontak ?? "");

  function reset(row: KlienRow | null) {
    setKode(row?.kode ?? "");
    setNama(row?.nama ?? "");
    setPic(row?.pic_nama ?? "");
    setKontak(row?.pic_kontak ?? "");
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset(editing);
    onOpenChange(v);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data: KlienFormData = { kode, nama, pic_nama: pic, pic_kontak: kontak };

    startTransition(async () => {
      const result = editing
        ? await updateKlienAction(editing.id, data)
        : await createKlienAction(data);

      if (!result.success) toast.error(result.error);
      else {
        toast.success(editing ? "Klien berhasil diperbarui" : "Klien berhasil ditambahkan");
        handleOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Klien" : "Tambah Klien"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="kode">Kode</Label>
              <Input
                id="kode"
                value={kode}
                onChange={(e) => setKode(e.target.value.toUpperCase())}
                placeholder="ASTEMO"
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nama">Nama Klien</Label>
              <Input
                id="nama"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="PT Astemo"
                required
                disabled={isPending}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pic">
              Nama PIC <span className="text-slate-400 font-normal">(opsional)</span>
            </Label>
            <Input
              id="pic"
              value={pic}
              onChange={(e) => setPic(e.target.value)}
              placeholder="Budi Santoso"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kontak">
              Kontak PIC <span className="text-slate-400 font-normal">(opsional)</span>
            </Label>
            <Input
              id="kontak"
              value={kontak}
              onChange={(e) => setKontak(e.target.value)}
              placeholder="08123456789"
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

export function KlienClientPage({ data }: { data: KlienRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<KlienRow | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<KlienRow | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const filtered = useMemo(() => {
    return data.filter((k) => {
      if (!showInactive && !k.is_active) return false;
      if (search) {
        const q = search.toLowerCase();
        return k.kode.toLowerCase().includes(q) || k.nama.toLowerCase().includes(q);
      }
      return true;
    });
  }, [data, search, showInactive]);

  function handleToggle() {
    if (!confirmToggle) return;
    startTransition(async () => {
      const result = await toggleKlienActiveAction(
        confirmToggle.id,
        !confirmToggle.is_active
      );
      if (!result.success) toast.error(result.error);
      else {
        toast.success(confirmToggle.is_active ? "Klien dinonaktifkan" : "Klien diaktifkan");
        router.refresh();
      }
      setConfirmToggle(null);
    });
  }

  return (
    <>
      <PageHeader
        title="Master Klien"
        description={`${data.filter((k) => k.is_active).length} klien aktif`}
        action={
          <Button onClick={() => { setEditing(null); setOpen(true); }} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Tambah Klien
          </Button>
        }
      />

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

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            message="Belum ada klien"
            action={
              <Button onClick={() => { setEditing(null); setOpen(true); }} size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                Tambah Klien
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Kode</TableHead>
                <TableHead>Nama Klien</TableHead>
                <TableHead>PIC</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-20 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((k) => (
                <TableRow key={k.id} className={!k.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-xs font-medium">{k.kode}</TableCell>
                  <TableCell className="font-medium">{k.nama}</TableCell>
                  <TableCell className="text-slate-500">{k.pic_nama ?? "—"}</TableCell>
                  <TableCell className="text-slate-500">{k.pic_kontak ?? "—"}</TableCell>
                  <TableCell><StatusBadge active={k.is_active} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => { setEditing(k); setOpen(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={k.is_active ? "Nonaktifkan" : "Aktifkan"} onClick={() => setConfirmToggle(k)}>
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

      {open && (
        <KlienFormDialog open={open} onOpenChange={setOpen} editing={editing} />
      )}

      <ConfirmDialog
        open={!!confirmToggle}
        onOpenChange={(v) => !v && setConfirmToggle(null)}
        title={confirmToggle?.is_active ? "Nonaktifkan Klien?" : "Aktifkan Klien?"}
        description={`Klien "${confirmToggle?.nama}" akan ${confirmToggle?.is_active ? "dinonaktifkan" : "diaktifkan kembali"}.`}
        confirmLabel={confirmToggle?.is_active ? "Nonaktifkan" : "Aktifkan"}
        variant={confirmToggle?.is_active ? "destructive" : "default"}
        onConfirm={handleToggle}
        loading={isPending}
      />
    </>
  );
}

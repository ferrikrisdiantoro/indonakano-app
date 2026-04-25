"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { generateTagihanAction } from "../actions";

type KlienOption = { id: string; kode: string; nama: string };
type KontrakOption = {
  id: string;
  klien_id: string;
  nomor_kontrak: string;
  tgl_tutup_periode_default: number | null;
};

function getDefaultPeriod(tglTutup: number | null): {
  mulai: string;
  akhir: string;
} {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-based

  if (tglTutup) {
    // e.g. tglTutup = 25: period = 26th prev month to 25th current month
    const akhirDate = new Date(year, month, tglTutup);
    // If today is before tglTutup, use previous month cycle
    if (today.getDate() <= tglTutup) {
      akhirDate.setMonth(akhirDate.getMonth() - 1);
    }
    const mulaiDate = new Date(akhirDate);
    mulaiDate.setDate(tglTutup + 1);
    mulaiDate.setMonth(mulaiDate.getMonth() - 1);

    return {
      mulai: mulaiDate.toISOString().split("T")[0],
      akhir: akhirDate.toISOString().split("T")[0],
    };
  }

  // Default: 1st to last day of current month
  const mulai = new Date(year, month, 1).toISOString().split("T")[0];
  const akhir = new Date(year, month + 1, 0).toISOString().split("T")[0];
  return { mulai, akhir };
}

export function GenerateTagihanDialog({
  open,
  onOpenChange,
  klienList,
  kontrakList,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  klienList: KlienOption[];
  kontrakList: KontrakOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [klienId, setKlienId] = useState("");
  const [kontrakId, setKontrakId] = useState("");
  const [periodeMulai, setPeriodeMulai] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0]
  );
  const [periodeAkhir, setPeriodeAkhir] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      .toISOString()
      .split("T")[0]
  );
  const [overridePeriode, setOverridePeriode] = useState(false);
  const [overrideAlasan, setOverrideAlasan] = useState("");

  // Auto-fill kontrak when klien selected
  useEffect(() => {
    if (klienId) {
      const match = kontrakList.find((k) => k.klien_id === klienId);
      setKontrakId(match?.id ?? "");
    } else {
      setKontrakId("");
    }
  }, [klienId, kontrakList]);

  // Auto-fill period when kontrak selected
  useEffect(() => {
    if (kontrakId) {
      const kontrak = kontrakList.find((k) => k.id === kontrakId);
      if (kontrak) {
        const { mulai, akhir } = getDefaultPeriod(kontrak.tgl_tutup_periode_default);
        setPeriodeMulai(mulai);
        setPeriodeAkhir(akhir);
      }
    }
  }, [kontrakId, kontrakList]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setKlienId("");
      setKontrakId("");
      setOverridePeriode(false);
      setOverrideAlasan("");
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await generateTagihanAction({
        klien_id: klienId,
        kontrak_id: kontrakId,
        periode_mulai: periodeMulai,
        periode_akhir: periodeAkhir,
        override_periode: overridePeriode,
        override_alasan: overrideAlasan,
      });
      if (!result.success) {
        toast.error(result.error);
      } else {
        toast.success("Draft tagihan berhasil dibuat");
        onOpenChange(false);
        if (result.id) router.push(`/tagihan/${result.id}`);
      }
    });
  }

  const selectCls =
    "w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Buat Draft Tagihan</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Klien */}
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

          {/* Kontrak */}
          <div className="space-y-1.5">
            <Label>Kontrak <span className="text-red-500">*</span></Label>
            <select
              value={kontrakId}
              onChange={(e) => setKontrakId(e.target.value)}
              required
              disabled={isPending}
              className={selectCls}
            >
              <option value="">— Pilih Kontrak —</option>
              {kontrakList
                .filter((k) => !klienId || k.klien_id === klienId)
                .map((k) => (
                  <option key={k.id} value={k.id}>{k.nomor_kontrak}</option>
                ))}
            </select>
          </div>

          {/* Periode */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Periode Mulai <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={periodeMulai}
                onChange={(e) => setPeriodeMulai(e.target.value)}
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Periode Akhir <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={periodeAkhir}
                onChange={(e) => setPeriodeAkhir(e.target.value)}
                required
                disabled={isPending}
              />
            </div>
          </div>

          {/* Override */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={overridePeriode}
                onChange={(e) => setOverridePeriode(e.target.checked)}
                disabled={isPending}
                className="rounded border-input"
              />
              <span className="text-sm text-slate-600">Override periode (di luar siklus normal)</span>
            </label>
            {overridePeriode && (
              <div className="space-y-1.5">
                <Label>Alasan Override</Label>
                <Input
                  value={overrideAlasan}
                  onChange={(e) => setOverrideAlasan(e.target.value)}
                  placeholder="Jelaskan alasan override periode"
                  disabled={isPending}
                  required={overridePeriode}
                />
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
            Tagihan akan dihitung berdasarkan stok alat yang ada di proyek klien saat ini dan harga dari kontrak yang dipilih.
          </div>

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
              {isPending ? "Membuat…" : "Buat Draft Tagihan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

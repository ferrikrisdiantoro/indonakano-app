"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateFormatTagihanAction } from "../actions";

const ROMAN_MONTHS = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];

export function FormatTagihanClientPage({
  prefix,
  nextSeq,
}: {
  prefix: string;
  nextSeq: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [invoicePrefix, setInvoicePrefix] = useState(prefix);
  const [invoiceNextSeq, setInvoiceNextSeq] = useState(String(nextSeq));

  const seqNum = parseInt(invoiceNextSeq) || 1;
  const today = new Date();
  const preview = `${invoicePrefix}/${String(seqNum).padStart(3, "0")}/${ROMAN_MONTHS[today.getMonth()]}/${today.getFullYear()}`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateFormatTagihanAction({
        prefix: invoicePrefix,
        next_seq: seqNum,
      });
      if (!result.success) toast.error(result.error);
      else toast.success("Format tagihan disimpan");
    });
  }

  return (
    <>
      <PageHeader
        title="Format Nomor Tagihan"
        description="Konfigurasi prefix dan nomor urut tagihan"
      />

      <div className="max-w-md">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="space-y-1.5">
            <Label>Prefix Tagihan</Label>
            <Input
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
              placeholder="PPA"
              required
              disabled={isPending}
            />
            <p className="text-xs text-slate-400">Contoh: PPA, INV, TAGIHAN</p>
          </div>

          <div className="space-y-1.5">
            <Label>Nomor Urut Berikutnya</Label>
            <Input
              type="number"
              min={1}
              value={invoiceNextSeq}
              onChange={(e) => setInvoiceNextSeq(e.target.value)}
              required
              disabled={isPending}
            />
            <p className="text-xs text-slate-400">
              Nomor ini akan digunakan untuk tagihan berikutnya.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Preview nomor tagihan:</p>
            <p className="font-mono text-sm font-medium text-slate-800">{preview}</p>
            <p className="text-xs text-slate-400 mt-1">
              Format: PREFIX/NNN/BULAN_ROMAWI/TAHUN
            </p>
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            <Save className="w-4 h-4 mr-1.5" />
            {isPending ? "Menyimpan…" : "Simpan Pengaturan"}
          </Button>
        </form>
      </div>
    </>
  );
}

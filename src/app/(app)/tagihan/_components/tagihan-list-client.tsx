"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateRange, formatRupiah } from "@/lib/utils";
import { GenerateTagihanDialog } from "./generate-form";
import type { TagihanStatus } from "@/types/database";

const STATUS_CONFIG: Record<
  TagihanStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Draft",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  FINAL: {
    label: "Final",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  VOID: {
    label: "Void",
    className: "bg-slate-100 text-slate-500 border border-slate-200",
  },
};

type TagihanListItem = {
  id: string;
  nomor: string;
  status: TagihanStatus;
  total: number;
  subtotal: number;
  ppn_persen: number;
  ppn_amount: number;
  periode_mulai: string;
  periode_akhir: string;
  generated_at: string;
  finalized_at: string | null;
  klien: { kode: string; nama: string } | null;
  kontrak: { nomor_kontrak: string } | null;
};

type KlienOption = { id: string; kode: string; nama: string };
type KontrakOption = {
  id: string;
  klien_id: string;
  nomor_kontrak: string;
  tgl_tutup_periode_default: number | null;
};

type Tab = "SEMUA" | TagihanStatus;

const TABS: { value: Tab; label: string }[] = [
  { value: "SEMUA", label: "Semua" },
  { value: "DRAFT", label: "Draft" },
  { value: "FINAL", label: "Final" },
  { value: "VOID", label: "Void" },
];

export function TagihanListClient({
  tagihanList,
  isAdmin,
  klienList,
  kontrakList,
}: {
  tagihanList: TagihanListItem[];
  isAdmin: boolean;
  klienList: KlienOption[];
  kontrakList: KontrakOption[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("SEMUA");
  const [openGenerate, setOpenGenerate] = useState(false);

  const filtered =
    activeTab === "SEMUA"
      ? tagihanList
      : tagihanList.filter((t) => t.status === activeTab);

  const counts: Record<Tab, number> = {
    SEMUA: tagihanList.length,
    DRAFT: tagihanList.filter((t) => t.status === "DRAFT").length,
    FINAL: tagihanList.filter((t) => t.status === "FINAL").length,
    VOID: tagihanList.filter((t) => t.status === "VOID").length,
  };

  return (
    <>
      <PageHeader
        title="Tagihan"
        description="Daftar tagihan sewa alat perancah"
        action={
          isAdmin ? (
            <Button size="sm" onClick={() => setOpenGenerate(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Buat Tagihan
            </Button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.value
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            {counts[tab.value] > 0 && (
              <span
                className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.value
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {counts[tab.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">No. Tagihan</TableHead>
              <TableHead>Klien</TableHead>
              <TableHead className="w-48">Periode</TableHead>
              <TableHead className="w-36 text-right">Total</TableHead>
              <TableHead className="w-24 text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-12 text-slate-400 text-sm"
                >
                  <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  Tidak ada tagihan
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => router.push(`/tagihan/${t.id}`)}
                >
                  <TableCell>
                    <p className="text-sm font-mono font-medium text-slate-800">
                      {t.nomor}
                    </p>
                    <p className="text-xs text-slate-400">
                      {t.kontrak?.nomor_kontrak ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">
                    <p className="font-medium text-slate-700">
                      {t.klien?.kode ?? "—"}
                    </p>
                    <p className="text-xs text-slate-400">{t.klien?.nama ?? ""}</p>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {formatDateRange(t.periode_mulai, t.periode_akhir)}
                  </TableCell>
                  <TableCell className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatRupiah(t.total)}
                    </p>
                    {t.ppn_persen > 0 && (
                      <p className="text-xs text-slate-400">
                        inkl. PPN {t.ppn_persen}%
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CONFIG[t.status].className}`}
                    >
                      {STATUS_CONFIG[t.status].label}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {isAdmin && (
        <GenerateTagihanDialog
          open={openGenerate}
          onOpenChange={setOpenGenerate}
          klienList={klienList}
          kontrakList={kontrakList}
        />
      )}
    </>
  );
}

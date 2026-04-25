import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateRange, formatRupiah } from "@/lib/utils";
import { PrintButton } from "./_components/print-button";

export const metadata: Metadata = { title: "Cetak Invoice" };

function displayHarga(price: number): string {
  const rounded = Math.round(price * 100) / 100;
  if (Number.isInteger(rounded)) {
    return `Rp ${new Intl.NumberFormat("id-ID").format(rounded)}`;
  }
  return `Rp ${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded)}`;
}

type TagihanItem = {
  id: string;
  alat_id: string;
  alat_nama: string;
  periode_teks: string;
  satuan: string;
  qty: number;
  lama: number;
  harga_per_satuan_snapshot: number;
  total: number;
  ordering: number;
};

export default async function PrintTagihanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tagihanRaw } = await (supabase as any)
    .from("tagihan")
    .select(
      "id, nomor, status, periode_mulai, periode_akhir, subtotal, ppn_persen, ppn_amount, total, finalized_at, generated_at, klien:klien_id(kode, nama), kontrak:kontrak_id(nomor_kontrak)"
    )
    .eq("id", id)
    .single();

  if (!tagihanRaw) notFound();

  const { data: items } = await supabase
    .from("tagihan_item")
    .select(
      "id, alat_id, alat_nama, periode_teks, satuan, qty, lama, harga_per_satuan_snapshot, total, ordering"
    )
    .eq("tagihan_id", id)
    .order("ordering");

  type TagihanData = {
    id: string;
    nomor: string;
    status: string;
    periode_mulai: string;
    periode_akhir: string;
    subtotal: number;
    ppn_persen: number;
    ppn_amount: number;
    total: number;
    finalized_at: string | null;
    generated_at: string;
    klien: { kode: string; nama: string } | null;
    kontrak: { nomor_kontrak: string } | null;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tagData = tagihanRaw as TagihanData;
  const itemList = (items ?? []) as TagihanItem[];

  // Group items by alat_id
  const groups: { alat_id: string; nama: string; rows: TagihanItem[] }[] = [];
  const seen = new Map<string, number>();
  for (const item of itemList) {
    if (!seen.has(item.alat_id)) {
      seen.set(item.alat_id, groups.length);
      groups.push({ alat_id: item.alat_id, nama: item.alat_nama, rows: [] });
    }
    groups[seen.get(item.alat_id)!].rows.push(item);
  }

  const tanggalDoc = tagData.finalized_at ?? tagData.generated_at;

  return (
    <>
      {/* Print-only global styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 15mm 15mm 15mm 15mm; size: A4; }
          body { font-size: 11pt; }
        }
      `}</style>

      {/* Action bar — hidden when printing */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <a
            href={`/tagihan/${id}`}
            className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
          >
            ← Kembali ke Detail
          </a>
          <span className="text-slate-300">|</span>
          <span className="text-sm text-slate-600 font-medium">{tagData.nomor}</span>
        </div>
        <PrintButton />
      </div>

      {/* Invoice body */}
      <div className="pt-16 no-print-pt px-6 py-8 max-w-3xl mx-auto print:pt-0 print:px-0">
        {/* Letterhead */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-800">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              PT PERANCAH PRO ALAT
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">PT INDONAKANO — Sewa Alat Perancah</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-800 tracking-wider">TAGIHAN SEWA</p>
            <p className="text-base font-mono font-semibold text-blue-700 mt-1">
              {tagData.nomor}
            </p>
            {tanggalDoc && (
              <p className="text-xs text-slate-500 mt-1">
                {new Intl.DateTimeFormat("id-ID", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  timeZone: "Asia/Jakarta",
                }).format(new Date(tanggalDoc))}
              </p>
            )}
          </div>
        </div>

        {/* Billing info */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Kepada
            </p>
            {tagData.klien ? (
              <>
                <p className="text-sm font-semibold text-slate-800">{tagData.klien.nama}</p>
                <p className="text-xs text-slate-500 font-mono">{tagData.klien.kode}</p>
              </>
            ) : (
              <p className="text-sm text-slate-400">—</p>
            )}
            {tagData.kontrak && (
              <p className="text-xs text-slate-500 mt-1">
                Kontrak: {tagData.kontrak.nomor_kontrak}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Periode Sewa
            </p>
            <p className="text-sm font-medium text-slate-800">
              {formatDateRange(tagData.periode_mulai, tagData.periode_akhir)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Status:{" "}
              <span className="font-medium text-slate-700">{tagData.status}</span>
            </p>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-sm border-collapse mb-8">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="text-left px-3 py-2 text-xs font-semibold w-6">No</th>
              <th className="text-left px-3 py-2 text-xs font-semibold">Nama Alat / Periode</th>
              <th className="text-right px-3 py-2 text-xs font-semibold w-10">Qty</th>
              <th className="text-center px-3 py-2 text-xs font-semibold w-10">Sat.</th>
              <th className="text-right px-3 py-2 text-xs font-semibold w-12">Lama</th>
              <th className="text-right px-3 py-2 text-xs font-semibold w-28">Harga/Sat.</th>
              <th className="text-right px-3 py-2 text-xs font-semibold w-28">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group, gi) => {
              const groupTotal = group.rows.reduce((s, r) => s + r.total, 0);
              const multiRow = group.rows.length > 1;
              let rowNum = groups.slice(0, gi).reduce((s, g) => s + g.rows.length, 1);
              return (
                <>
                  {group.rows.map((item, ri) => (
                    <tr
                      key={item.id}
                      className={ri % 2 === 0 ? "bg-white" : "bg-slate-50"}
                    >
                      <td className="px-3 py-1.5 text-slate-400 text-xs text-center align-top">
                        {ri === 0 ? rowNum++ : ""}
                      </td>
                      <td className="px-3 py-1.5 align-top">
                        <span className={ri === 0 ? "font-medium text-slate-800" : "text-slate-500 text-xs pl-2"}>
                          {ri === 0 ? item.alat_nama : `↳ ${item.alat_nama}`}
                        </span>
                        {item.periode_teks && (
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            {item.periode_teks}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right align-top">{item.qty}</td>
                      <td className="px-3 py-1.5 text-center align-top text-slate-600">
                        {item.satuan}
                      </td>
                      <td className="px-3 py-1.5 text-right align-top text-slate-600">
                        {item.lama % 1 === 0 ? item.lama : item.lama.toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5 text-right align-top font-mono text-xs">
                        {displayHarga(item.harga_per_satuan_snapshot)}
                      </td>
                      <td className="px-3 py-1.5 text-right align-top font-medium font-mono text-xs">
                        {formatRupiah(item.total)}
                      </td>
                    </tr>
                  ))}
                  {multiRow && (
                    <tr className="bg-slate-100 border-t border-slate-200">
                      <td colSpan={6} className="px-3 py-1 text-right text-xs text-slate-500">
                        Sub total {group.nama}
                      </td>
                      <td className="px-3 py-1 text-right text-xs font-semibold text-slate-700 font-mono">
                        {formatRupiah(groupTotal)}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {itemList.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400 text-sm">
                  Tidak ada item
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-10">
          <div className="w-64">
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium font-mono">{formatRupiah(tagData.subtotal)}</span>
            </div>
            {tagData.ppn_persen > 0 && (
              <div className="flex justify-between py-1.5 text-sm">
                <span className="text-slate-500">PPN {tagData.ppn_persen}%</span>
                <span className="font-medium font-mono">{formatRupiah(tagData.ppn_amount)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 text-base font-bold border-t-2 border-slate-800 mt-1">
              <span>TOTAL</span>
              <span className="font-mono">{formatRupiah(tagData.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-6 text-xs text-slate-400 text-center">
          <p>PT PERANCAH PRO ALAT / PT INDONAKANO · Sistem Manajemen Sewa Alat Perancah</p>
          <p className="mt-0.5">Dokumen ini dicetak secara otomatis dari sistem. Sah tanpa tanda tangan basah.</p>
        </div>
      </div>
    </>
  );
}

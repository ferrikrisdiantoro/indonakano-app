import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatDateShort } from "@/lib/utils";
import { RekapFilter } from "./_components/rekap-filter";
import { RekapExportButton } from "./_components/rekap-export-button";
import type { TipeTransaksi } from "@/types/database";

export const metadata: Metadata = { title: "Rekap Stok" };

type AlatInfo = { id: string; kode: string; nama: string; satuan_default: string };

type TxnItem = { alat_id: string; qty: number; alat: AlatInfo | null };
type TxnRec = {
  id: string;
  tipe: TipeTransaksi;
  tanggal: string;
  no_sj: string | null;
  no_sj_operan: string | null;
  klien_id: string | null;
  klien_tujuan_id: string | null;
  items: TxnItem[];
};

/** Returns signed qty delta for this klien (positive = incoming, negative = outgoing) */
function getDeltaMap(txn: TxnRec, klienId: string): Map<string, number> {
  const m = new Map<string, number>();
  const sign =
    txn.tipe === "PENGIRIMAN" && txn.klien_id === klienId
      ? 1
      : (txn.tipe === "RETUR" || txn.tipe === "CLAIM") && txn.klien_id === klienId
      ? -1
      : txn.tipe === "TRANSFER" && txn.klien_id === klienId
      ? -1
      : txn.tipe === "TRANSFER" && txn.klien_tujuan_id === klienId
      ? 1
      : 0;
  if (sign === 0) return m;
  txn.items.forEach((i) => m.set(i.alat_id, i.qty * sign));
  return m;
}

const TIPE_LABEL: Record<TipeTransaksi, string> = {
  PENGIRIMAN: "Pengiriman",
  RETUR: "Retur",
  CLAIM: "Claim",
  TRANSFER: "Transfer",
  STOCK_ADJUSTMENT: "Adj. Stok",
};

const TIPE_COLOR: Record<TipeTransaksi, string> = {
  PENGIRIMAN: "text-emerald-700 bg-emerald-50 border border-emerald-200",
  RETUR: "text-blue-700 bg-blue-50 border border-blue-200",
  CLAIM: "text-red-700 bg-red-50 border border-red-200",
  TRANSFER: "text-purple-700 bg-purple-50 border border-purple-200",
  STOCK_ADJUSTMENT: "text-slate-600 bg-slate-100 border border-slate-200",
};

export default async function RekapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const klienId = sp.klien_id ?? "";
  const mulai = sp.mulai ?? "";
  const akhir = sp.akhir ?? "";

  const supabase = await createClient();

  // Always fetch klien list for filter
  const { data: klienRaw } = await supabase
    .from("klien")
    .select("id, kode, nama")
    .eq("is_active", true)
    .order("kode");
  const klienList = (klienRaw ?? []) as { id: string; kode: string; nama: string }[];

  // Also build a quick klien-id → kode map for TRANSFER labels
  const klienMap = new Map<string, string>(klienList.map((k) => [k.id, k.kode]));

  if (!klienId || !mulai || !akhir) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Rekap Stok per Proyek</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Pilih proyek dan periode untuk melihat mutasi stok
          </p>
        </div>
        <RekapFilter klienList={klienList} klienId="" mulai="" akhir="" />
      </div>
    );
  }

  // ── Fetch current stok_proyek for this klien ──────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stokRaw } = await (supabase as any)
    .from("stok_proyek")
    .select("alat_id, qty, alat:alat_id(id, kode, nama, satuan_default)")
    .eq("klien_id", klienId);

  type StokRow = { alat_id: string; qty: number; alat: AlatInfo | null };
  const stokProyek = (stokRaw ?? []) as StokRow[];
  const currentStok = new Map<string, number>(stokProyek.map((s) => [s.alat_id, s.qty]));

  // ── Fetch APPROVED transactions for this klien (all dates >= mulai) ─
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: txnRaw } = await (supabase as any)
    .from("transaksi")
    .select(
      "id, tipe, tanggal, no_sj, no_sj_operan, klien_id, klien_tujuan_id, items:transaksi_item(alat_id, qty, alat:alat_id(id, kode, nama, satuan_default))"
    )
    .eq("status", "APPROVED")
    .or(`klien_id.eq.${klienId},klien_tujuan_id.eq.${klienId}`)
    .gte("tanggal", mulai)
    .order("tanggal")
    .order("created_at");

  const allTxns = (txnRaw ?? []) as TxnRec[];
  const postPeriod = allTxns.filter((t) => t.tanggal > akhir);
  const inPeriod = allTxns.filter((t) => t.tanggal >= mulai && t.tanggal <= akhir);

  // ── Compute stok at period_akhir (undo post-period transactions) ───
  const stokAtPeriodEnd = new Map<string, number>(currentStok);
  for (const txn of postPeriod) {
    const delta = getDeltaMap(txn, klienId);
    delta.forEach((qty, alatId) => {
      stokAtPeriodEnd.set(alatId, (stokAtPeriodEnd.get(alatId) ?? 0) - qty);
    });
  }

  // ── Compute stok_awal (undo in-period transactions) ───────────────
  const stokAwal = new Map<string, number>(stokAtPeriodEnd);
  for (const txn of inPeriod) {
    const delta = getDeltaMap(txn, klienId);
    delta.forEach((qty, alatId) => {
      stokAwal.set(alatId, (stokAwal.get(alatId) ?? 0) - qty);
    });
  }

  // ── Build alat columns ────────────────────────────────────────────
  const alatById = new Map<string, AlatInfo>();
  stokProyek.forEach((s) => { if (s.alat) alatById.set(s.alat_id, s.alat); });
  inPeriod.forEach((t) =>
    t.items.forEach((i) => { if (i.alat) alatById.set(i.alat_id, i.alat); })
  );

  // Only include alat that have any activity or stok != 0
  const activeAlatIds = new Set<string>();
  alatById.forEach((_, id) => {
    if ((stokAwal.get(id) ?? 0) !== 0) activeAlatIds.add(id);
  });
  inPeriod.forEach((t) => t.items.forEach((i) => activeAlatIds.add(i.alat_id)));

  const alatCols = Array.from(activeAlatIds)
    .map((id) => alatById.get(id)!)
    .filter(Boolean)
    .sort((a, b) => a.kode.localeCompare(b.kode));

  // ── Running stok for display ──────────────────────────────────────
  const running = new Map<string, number>(stokAwal);

  const klienInfo = klienList.find((k) => k.id === klienId);

  // ── Build export data ─────────────────────────────────────────────
  const exportHeaders = ["Tanggal", "No. SJ", "Tipe", ...alatCols.map((a) => a.kode)];
  const exportRows: (string | number)[][] = [
    ["—", "—", "Stok Awal", ...alatCols.map((a) => stokAwal.get(a.id) ?? 0)],
    ...inPeriod.map((txn) => {
      const delta = getDeltaMap(txn, klienId);
      let tipeLabel = TIPE_LABEL[txn.tipe];
      if (txn.tipe === "TRANSFER") {
        if (txn.klien_id === klienId && txn.klien_tujuan_id) tipeLabel = `→ ${klienMap.get(txn.klien_tujuan_id) ?? "?"}`;
        else if (txn.klien_tujuan_id === klienId && txn.klien_id) tipeLabel = `← ${klienMap.get(txn.klien_id) ?? "?"}`;
      }
      return [
        formatDateShort(txn.tanggal),
        txn.no_sj_operan || txn.no_sj || "—",
        tipeLabel,
        ...alatCols.map((a) => delta.get(a.id) ?? ""),
      ];
    }),
    ["—", "—", "Stok Akhir", ...alatCols.map((a) => stokAtPeriodEnd.get(a.id) ?? 0)],
  ];
  const exportFilename = `rekap_${klienInfo?.kode ?? klienId}_${mulai}_${akhir}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Rekap Stok per Proyek</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Mutasi stok APPROVED per proyek per periode
        </p>
      </div>

      <RekapFilter klienList={klienList} klienId={klienId} mulai={mulai} akhir={akhir} />

      {/* Rekap header */}
      {klienInfo && (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {klienInfo.kode} — {klienInfo.nama}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Periode: {formatDateShort(mulai)} – {formatDateShort(akhir)}
              {" · "}
              {inPeriod.length} transaksi APPROVED
            </p>
          </div>
          {alatCols.length > 0 && (
            <RekapExportButton
              filename={exportFilename}
              headers={exportHeaders}
              rows={exportRows}
            />
          )}
        </div>
      )}

      {alatCols.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-sm text-slate-400">
            Tidak ada data stok atau transaksi untuk periode ini
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 whitespace-nowrap w-24">
                    Tanggal
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 whitespace-nowrap w-32">
                    No. SJ
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 whitespace-nowrap w-32">
                    Tipe
                  </th>
                  {alatCols.map((alat) => (
                    <th
                      key={alat.id}
                      className="text-right px-3 py-2 text-xs font-semibold text-slate-600 whitespace-nowrap min-w-[80px]"
                      title={alat.nama}
                    >
                      <span className="font-mono">{alat.kode}</span>
                      <br />
                      <span className="font-normal text-slate-400 text-[10px]">{alat.satuan_default}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Stok Awal row */}
                <tr className="bg-amber-50 border-b border-amber-200 font-medium">
                  <td className="px-3 py-2 text-xs text-slate-500">—</td>
                  <td className="px-3 py-2 text-xs text-slate-500">—</td>
                  <td className="px-3 py-2 text-xs text-amber-700 font-semibold">Stok Awal</td>
                  {alatCols.map((alat) => {
                    const qty = stokAwal.get(alat.id) ?? 0;
                    return (
                      <td key={alat.id} className="px-3 py-2 text-right text-sm font-semibold text-slate-900">
                        {qty || "—"}
                      </td>
                    );
                  })}
                </tr>

                {/* Transaction rows */}
                {inPeriod.map((txn) => {
                  const delta = getDeltaMap(txn, klienId);
                  delta.forEach((qty, alatId) => {
                    running.set(alatId, (running.get(alatId) ?? 0) + qty);
                  });
                  const noSj = txn.no_sj_operan || txn.no_sj || "—";
                  let tipeLabel = TIPE_LABEL[txn.tipe];
                  if (txn.tipe === "TRANSFER") {
                    if (txn.klien_id === klienId && txn.klien_tujuan_id) {
                      tipeLabel = `→ ${klienMap.get(txn.klien_tujuan_id) ?? "?"}`;
                    } else if (txn.klien_tujuan_id === klienId && txn.klien_id) {
                      tipeLabel = `← ${klienMap.get(txn.klien_id) ?? "?"}`;
                    }
                  }
                  return (
                    <tr key={txn.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                        {formatDateShort(txn.tanggal)}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-600 whitespace-nowrap">
                        {noSj}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${TIPE_COLOR[txn.tipe]}`}
                        >
                          {tipeLabel}
                        </span>
                      </td>
                      {alatCols.map((alat) => {
                        const d = delta.get(alat.id);
                        return (
                          <td key={alat.id} className="px-3 py-2 text-right text-sm whitespace-nowrap">
                            {d != null && d !== 0 ? (
                              <span
                                className={d > 0 ? "text-emerald-700 font-semibold" : "text-red-600 font-semibold"}
                              >
                                {d > 0 ? `+${d}` : d}
                              </span>
                            ) : (
                              <span className="text-slate-200">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {inPeriod.length === 0 && (
                  <tr>
                    <td colSpan={3 + alatCols.length} className="px-3 py-6 text-center text-slate-400 text-sm">
                      Tidak ada transaksi APPROVED dalam periode ini
                    </td>
                  </tr>
                )}

                {/* Stok Akhir row */}
                <tr className="bg-emerald-50 border-t-2 border-emerald-300 font-medium">
                  <td className="px-3 py-2 text-xs text-slate-500">—</td>
                  <td className="px-3 py-2 text-xs text-slate-500">—</td>
                  <td className="px-3 py-2 text-xs text-emerald-700 font-semibold">Stok Akhir</td>
                  {alatCols.map((alat) => {
                    const qty = stokAtPeriodEnd.get(alat.id) ?? 0;
                    return (
                      <td key={alat.id} className="px-3 py-2 text-right text-sm font-bold text-slate-900">
                        {qty || "—"}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

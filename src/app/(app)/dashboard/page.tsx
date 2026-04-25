import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatRupiahShort, formatRupiah, formatDate, formatDateRange } from "@/lib/utils";
import { Package, ArrowRightLeft, Clock, FileText, AlertTriangle } from "lucide-react";
import { DashboardExportButton } from "./_components/dashboard-export-button";

export const metadata: Metadata = { title: "Dashboard" };

interface StokRow {
  qty_tersedia: number;
  alat: { nama: string } | null;
}

interface TagihanRow {
  id: string;
  nomor: string;
  klien: { id: string; kode: string; nama: string } | null;
  periode_mulai: string;
  periode_akhir: string;
  total: number;
  status: string;
  generated_at: string;
}

async function getDashboardData(filterMulai: string, filterAkhir: string, filterKlienId: string) {
  const supabase = await createClient();

  const now = new Date();
  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();

  const [
    { count: pendingCount },
    { count: proyekAktif },
    { count: transaksiCount },
    { count: tagihanCount },
    { data: stokRaw },
    { data: tagihanTerbaruRaw },
    { data: tagihanRekapRaw },
    { data: klienRaw },
    { data: kontrakAktifRaw },
    { data: stokMinusRaw },
    { data: overrideTrxRaw },
  ] = await Promise.all([
    supabase
      .from("transaksi")
      .select("*", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL"),
    supabase
      .from("stok_proyek")
      .select("klien_id", { count: "exact", head: true })
      .gt("qty", 0),
    supabase
      .from("transaksi")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth),
    supabase
      .from("tagihan")
      .select("*", { count: "exact", head: true })
      .gte("generated_at", startOfMonth),
    supabase
      .from("stok_gudang")
      .select("qty_tersedia, alat:alat_id(nama)")
      .gt("qty_tersedia", 0)
      .order("qty_tersedia", { ascending: false })
      .limit(5),
    supabase
      .from("tagihan")
      .select("id, nomor, klien:klien_id(id, kode, nama), total, status, generated_at")
      .order("generated_at", { ascending: false })
      .limit(5),
    // Fetch tagihan for rekap sections (only FINAL + DRAFT, filtered by date)
    (() => {
      let q = supabase
        .from("tagihan")
        .select(
          "id, nomor, klien:klien_id(id, kode, nama), periode_mulai, periode_akhir, total, status, generated_at"
        )
        .in("status", ["FINAL", "DRAFT"])
        .order("periode_mulai", { ascending: false });
      if (filterMulai) q = q.gte("periode_mulai", filterMulai);
      if (filterAkhir) q = q.lte("periode_akhir", filterAkhir);
      if (filterKlienId) q = q.eq("klien_id", filterKlienId);
      return q;
    })(),
    supabase.from("klien").select("id, kode, nama").eq("is_active", true).order("kode"),
    // Kontrak aktif — used to detect which klien have no tagihan this month
    supabase.from("kontrak_sewa").select("id, klien_id, klien:klien_id(kode, nama)").eq("status", "AKTIF"),
    // Stok gudang below zero
    supabase.from("stok_gudang").select("qty_tersedia, alat:alat_id(kode, nama)").lt("qty_tersedia", 0),
    // Recent APPROVED override_stok_minus transactions (last 30 days)
    (() => {
      const thirtyDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 30)).toISOString().slice(0, 10);
      return supabase
        .from("transaksi")
        .select("id, tanggal, no_sj, klien:klien_id(kode)")
        .eq("override_stok_minus", true)
        .eq("status", "APPROVED")
        .gte("tanggal", thirtyDaysAgo)
        .order("tanggal", { ascending: false })
        .limit(10);
    })(),
  ]);

  type StokMinusRow = { qty_tersedia: number; alat: { kode: string; nama: string } | null };
  type OverrideTrxRow = { id: string; tanggal: string; no_sj: string | null; klien: { kode: string } | null };
  type KontrakAktifRow = { id: string; klien_id: string; klien: { kode: string; nama: string } | null };

  const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);

  // FR-DASHBOARD-03 + FR-DASHBOARD-08 — run in parallel
  const [{ data: tagihanThisMonth }, { data: pengirimanThisMonth }] = await Promise.all([
    supabase
      .from("tagihan")
      .select("klien_id")
      .gte("generated_at", thisMonthStart)
      .in("status", ["DRAFT", "FINAL"]),
    supabase
      .from("transaksi")
      .select("items:transaksi_item(alat_id, qty, alat:alat_id(kode, nama))")
      .eq("status", "APPROVED")
      .eq("tipe", "PENGIRIMAN")
      .gte("tanggal", thisMonthStart),
  ]);
  const klienWithTagihanThisMonth = new Set(
    (tagihanThisMonth ?? []).map((t: { klien_id: string }) => t.klien_id)
  );
  const kontrakTanpaTagihan = ((kontrakAktifRaw ?? []) as KontrakAktifRow[])
    .filter((k) => !klienWithTagihanThisMonth.has(k.klien_id))
    .reduce<KontrakAktifRow[]>((acc, k) => {
      if (!acc.some((a) => a.klien_id === k.klien_id)) acc.push(k);
      return acc;
    }, []);

  // FR-DASHBOARD-08: aggregate top 10 alat by pengiriman qty this month
  type PengirimanTrx = { items: { alat_id: string; qty: number; alat: { kode: string; nama: string } | null }[] };
  const alatQtyMap = new Map<string, { kode: string; nama: string; total: number }>();
  for (const trx of (pengirimanThisMonth ?? []) as unknown as PengirimanTrx[]) {
    for (const item of trx.items) {
      const prev = alatQtyMap.get(item.alat_id);
      if (prev) prev.total += item.qty;
      else alatQtyMap.set(item.alat_id, { kode: item.alat?.kode ?? "?", nama: item.alat?.nama ?? "?", total: item.qty });
    }
  }
  const top10Alat = Array.from(alatQtyMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    pendingCount: pendingCount ?? 0,
    proyekAktif: proyekAktif ?? 0,
    transaksiCount: transaksiCount ?? 0,
    tagihanCount: tagihanCount ?? 0,
    stokGudangTop: (stokRaw ?? []) as StokRow[],
    tagihanTerbaru: (tagihanTerbaruRaw ?? []) as TagihanRow[],
    tagihanRekap: (tagihanRekapRaw ?? []) as TagihanRow[],
    klienList: (klienRaw ?? []) as { id: string; kode: string; nama: string }[],
    stokMinus: (stokMinusRaw ?? []) as StokMinusRow[],
    overrideTrx: (overrideTrxRaw ?? []) as OverrideTrxRow[],
    kontrakTanpaTagihan,
    top10Alat,
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const filterMulai = sp.mulai ?? "";
  const filterAkhir = sp.akhir ?? "";
  const filterKlienId = sp.klien_id ?? "";
  const rekapTab = sp.tab ?? "proyek";

  const {
    pendingCount,
    proyekAktif,
    transaksiCount,
    tagihanCount,
    stokGudangTop,
    tagihanTerbaru,
    tagihanRekap,
    klienList,
    stokMinus,
    overrideTrx,
    kontrakTanpaTagihan,
    top10Alat,
  } = await getDashboardData(filterMulai, filterAkhir, filterKlienId);

  const cards = [
    {
      label: "Pending Approval",
      value: pendingCount,
      icon: Clock,
      color: pendingCount > 0 ? "text-orange-600 bg-orange-50" : "text-slate-500 bg-slate-100",
      href: "/transaksi/pending",
    },
    {
      label: "Proyek Aktif",
      value: proyekAktif,
      icon: Package,
      color: "text-blue-600 bg-blue-50",
      href: "/rekap",
    },
    {
      label: "Transaksi Bulan Ini",
      value: transaksiCount,
      icon: ArrowRightLeft,
      color: "text-emerald-600 bg-emerald-50",
      href: "/transaksi",
    },
    {
      label: "Tagihan Bulan Ini",
      value: tagihanCount,
      icon: FileText,
      color: "text-purple-600 bg-purple-50",
      href: "/tagihan",
    },
  ];

  const statusColor: Record<string, string> = {
    DRAFT: "text-slate-500 bg-slate-100",
    FINAL: "text-emerald-700 bg-emerald-50",
    VOID: "text-red-600 bg-red-50",
  };

  // ── Group tagihan for rekap sections ──────────────────────────────

  // FR-DASHBOARD-04: per proyek — group by klien, list tagihan, cumulative total
  const byProyek = new Map<
    string,
    { klien: { id: string; kode: string; nama: string }; rows: TagihanRow[]; total: number }
  >();
  for (const t of tagihanRekap) {
    if (!t.klien) continue;
    if (!byProyek.has(t.klien.id)) {
      byProyek.set(t.klien.id, { klien: t.klien, rows: [], total: 0 });
    }
    const g = byProyek.get(t.klien.id)!;
    g.rows.push(t);
    g.total += t.total;
  }
  const proyekGroups = Array.from(byProyek.values()).sort((a, b) =>
    a.klien.kode.localeCompare(b.klien.kode)
  );

  // FR-DASHBOARD-05: per bulan — group by (periode_mulai+periode_akhir)
  type PeriodGroup = {
    key: string;
    mulai: string;
    akhir: string;
    rows: TagihanRow[];
    total: number;
  };
  const byPeriod = new Map<string, PeriodGroup>();
  for (const t of tagihanRekap) {
    const key = `${t.periode_mulai}|${t.periode_akhir}`;
    if (!byPeriod.has(key)) {
      byPeriod.set(key, { key, mulai: t.periode_mulai, akhir: t.periode_akhir, rows: [], total: 0 });
    }
    const g = byPeriod.get(key)!;
    g.rows.push(t);
    g.total += t.total;
  }
  const periodGroups = Array.from(byPeriod.values()).sort((a, b) =>
    b.mulai.localeCompare(a.mulai)
  );

  const grandTotal = tagihanRekap.reduce((s, t) => s + t.total, 0);

  const exportRows = tagihanRekap.map((t) => ({
    nomor: t.nomor,
    klien: (t.klien as { kode: string; nama: string } | null)
      ? `${(t.klien as { kode: string; nama: string }).kode} — ${(t.klien as { kode: string; nama: string }).nama}`
      : "—",
    periode: formatDateRange(t.periode_mulai, t.periode_akhir),
    total: t.total,
    status: t.status,
  }));

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <a
            key={card.label}
            href={card.href}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{card.value}</p>
              </div>
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────── */}
      {(kontrakTanpaTagihan.length > 0 || stokMinus.length > 0 || overrideTrx.length > 0) && (
        <div className="space-y-3">
          {kontrakTanpaTagihan.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                  <p className="text-sm font-semibold text-blue-700">
                    Belum Ada Tagihan Bulan Ini ({kontrakTanpaTagihan.length} klien)
                  </p>
                </div>
                <a href="/tagihan" className="text-xs text-blue-600 hover:underline shrink-0">
                  Generate tagihan →
                </a>
              </div>
              <div className="flex flex-wrap gap-2">
                {kontrakTanpaTagihan.map((k) => (
                  <span
                    key={k.klien_id}
                    className="inline-flex items-center gap-1 text-xs bg-white border border-blue-200 text-blue-800 px-2 py-1 rounded-md"
                  >
                    <span className="font-mono font-semibold">{k.klien?.kode ?? "?"}</span>
                    <span className="text-blue-400">—</span>
                    <span>{k.klien?.nama ?? k.klien_id}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {stokMinus.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm font-semibold text-red-700">
                  Stok Gudang Minus ({stokMinus.length} alat)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {stokMinus.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-white border border-red-200 text-red-700 px-2 py-1 rounded-md">
                    <span className="font-mono font-semibold">{s.alat?.kode ?? "?"}</span>
                    <span className="text-red-400">—</span>
                    <span className="font-bold">{s.qty_tersedia}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {overrideTrx.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-sm font-semibold text-amber-700">
                  Transaksi Override Stok Minus (30 hari terakhir)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {overrideTrx.map((t) => (
                  <a
                    key={t.id}
                    href={`/transaksi/${t.id}`}
                    className="inline-flex items-center gap-1 text-xs bg-white border border-amber-200 text-amber-800 px-2 py-1 rounded-md hover:bg-amber-50"
                  >
                    <span className="font-mono">{t.klien?.kode ?? "?"}</span>
                    {t.no_sj && <span className="text-amber-400">·</span>}
                    {t.no_sj && <span>{t.no_sj}</span>}
                    <span className="text-amber-400">·</span>
                    <span>{t.tanggal}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top stok gudang */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Stok Gudang Terbesar</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {stokGudangTop.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-400 text-center">Belum ada data stok</p>
            ) : (
              stokGudangTop.map((row, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-slate-700">{row.alat?.nama ?? "—"}</span>
                  <span className="text-sm font-semibold text-slate-900">{row.qty_tersedia} unit</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tagihan terbaru */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Tagihan Terbaru</h2>
            <a href="/tagihan" className="text-xs text-blue-600 hover:underline">Lihat semua</a>
          </div>
          <div className="divide-y divide-slate-100">
            {tagihanTerbaru.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-400 text-center">Belum ada tagihan</p>
            ) : (
              tagihanTerbaru.map((t) => (
                <a
                  key={t.id}
                  href={`/tagihan/${t.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{t.nomor}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {(t.klien as { nama: string } | null)?.nama} · {formatDate(t.generated_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${statusColor[t.status] ?? ""}`}>
                      {t.status}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatRupiahShort(t.total)}
                    </span>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── FR-DASHBOARD-08: Top 10 Alat Pengiriman Bulan Ini ─────────── */}
      {top10Alat.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Top Alat — Pengiriman Bulan Ini</h2>
          </div>
          <div className="px-4 py-3 space-y-2.5">
            {top10Alat.map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 text-xs text-slate-400 text-right shrink-0">{i + 1}</span>
                <span className="w-28 text-xs font-mono text-slate-600 truncate shrink-0" title={a.nama}>{a.kode}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-3 relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
                    style={{ width: `${Math.round((a.total / top10Alat[0].total) * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-xs font-semibold text-slate-700 text-right shrink-0">{a.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Rekap Tagihan (FR-DASHBOARD-04/05) ─────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200">
        {/* Header + filter */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-semibold text-slate-800">Rekap Tagihan</h2>
            <div className="flex items-center gap-3">
              {grandTotal > 0 && (
                <span className="text-xs text-slate-500">
                  Total: <span className="font-semibold text-slate-800">{formatRupiah(grandTotal)}</span>
                </span>
              )}
              <DashboardExportButton rows={exportRows} />
            </div>
          </div>
          {/* Filter bar */}
          <form className="flex flex-wrap gap-2 mt-3 items-end">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-slate-400 block">Klien / Proyek</label>
              <select
                name="klien_id"
                defaultValue={filterKlienId}
                className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Semua klien</option>
                {klienList.map((k) => (
                  <option key={k.id} value={k.id}>{k.kode} — {k.nama}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-slate-400 block">Dari periode</label>
              <input
                type="date"
                name="mulai"
                defaultValue={filterMulai}
                className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-slate-400 block">Sampai periode</label>
              <input
                type="date"
                name="akhir"
                defaultValue={filterAkhir}
                className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <input type="hidden" name="tab" value={rekapTab} />
            <button
              type="submit"
              className="px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded transition-colors hover:bg-slate-700"
            >
              Filter
            </button>
            {(filterMulai || filterAkhir || filterKlienId) && (
              <a
                href="/dashboard"
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
              >
                Reset
              </a>
            )}
          </form>
          {/* Tab switcher */}
          <div className="flex gap-1 mt-3">
            {(["proyek", "bulan"] as const).map((tab) => {
              const active = rekapTab === tab;
              const params = new URLSearchParams({
                tab,
                ...(filterMulai ? { mulai: filterMulai } : {}),
                ...(filterAkhir ? { akhir: filterAkhir } : {}),
                ...(filterKlienId ? { klien_id: filterKlienId } : {}),
              });
              return (
                <Link
                  key={tab}
                  href={`/dashboard?${params.toString()}`}
                  className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                    active
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {tab === "proyek" ? "Per Proyek" : "Per Bulan"}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="divide-y divide-slate-100">
          {rekapTab === "proyek" ? (
            proyekGroups.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-400 text-center">
                Belum ada tagihan{filterMulai || filterAkhir ? " untuk filter ini" : ""}
              </p>
            ) : (
              proyekGroups.map((g) => (
                <div key={g.klien.id}>
                  {/* Proyek header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50">
                    <div>
                      <span className="text-xs font-semibold text-slate-700">{g.klien.kode}</span>
                      <span className="text-xs text-slate-500 ml-1.5">— {g.klien.nama}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-800">
                      {formatRupiahShort(g.total)}
                    </span>
                  </div>
                  {/* Tagihan list */}
                  {g.rows.map((t) => (
                    <a
                      key={t.id}
                      href={`/tagihan/${t.id}`}
                      className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 pl-8"
                    >
                      <div>
                        <span className="text-xs font-mono text-slate-600">{t.nomor}</span>
                        <span className="text-xs text-slate-400 ml-2">
                          {formatDateRange(t.periode_mulai, t.periode_akhir)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor[t.status] ?? ""}`}>
                          {t.status}
                        </span>
                        <span className="text-xs font-semibold text-slate-700">
                          {formatRupiahShort(t.total)}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              ))
            )
          ) : periodGroups.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-400 text-center">
              Belum ada tagihan{filterMulai || filterAkhir ? " untuk filter ini" : ""}
            </p>
          ) : (
            periodGroups.map((pg) => (
              <div key={pg.key}>
                {/* Period header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50">
                  <span className="text-xs font-semibold text-slate-700">
                    {formatDateRange(pg.mulai, pg.akhir)}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">
                    {formatRupiahShort(pg.total)}
                  </span>
                </div>
                {/* Per-klien rows */}
                {pg.rows.map((t) => (
                  <a
                    key={t.id}
                    href={`/tagihan/${t.id}`}
                    className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 pl-8"
                  >
                    <div>
                      <span className="text-xs font-medium text-slate-700">
                        {(t.klien as { kode: string; nama: string } | null)?.kode ?? "—"}
                      </span>
                      <span className="text-xs text-slate-400 ml-1.5">
                        {(t.klien as { kode: string; nama: string } | null)?.nama}
                      </span>
                      <span className="text-xs font-mono text-slate-400 ml-2">{t.nomor}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor[t.status] ?? ""}`}>
                        {t.status}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {formatRupiahShort(t.total)}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

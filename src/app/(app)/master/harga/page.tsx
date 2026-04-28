import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { formatRupiah } from "@/lib/utils";
import { ExternalLink, Lock, Unlock } from "lucide-react";

export const metadata: Metadata = { title: "Harga Sewa" };

interface HargaRow {
  id: string;
  kontrak_id: string;
  alat_id: string;
  harga_bulanan: number;
  locked: boolean;
  alat: { kode: string; nama: string } | null;
  kontrak: {
    id: string;
    nomor_kontrak: string;
    status: string;
    klien: { kode: string; nama: string } | null;
  } | null;
}

export default async function MasterHargaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const filterKlien = sp.klien_id ?? "";
  const filterAlat = sp.alat_id ?? "";

  const supabase = await createClient();

  const [hargaResult, klienResult, alatResult] = await Promise.all([
    supabase
      .from("harga_sewa")
      .select("id, kontrak_id, alat_id, harga_bulanan, locked, alat:alat_id(kode, nama), kontrak:kontrak_id(id, nomor_kontrak, status, klien:klien_id(kode, nama))")
      .order("harga_bulanan", { ascending: false })
      .limit(500),
    supabase.from("klien").select("id, kode, nama").eq("is_active", true).order("kode"),
    supabase.from("alat").select("id, kode, nama").eq("is_active", true).order("kode"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows = (hargaResult.data ?? []) as unknown as HargaRow[];

  // Filter client-side (data sudah dimuat)
  if (filterKlien) {
    rows = rows.filter((r) => r.kontrak?.klien && (klienResult.data ?? []).some((k) => k.id === filterKlien && k.kode === r.kontrak?.klien?.kode));
  }
  if (filterAlat) {
    rows = rows.filter((r) => r.alat_id === filterAlat);
  }

  // Group by kontrak
  type Group = {
    kontrakId: string;
    nomorKontrak: string;
    klienKode: string;
    klienNama: string;
    status: string;
    items: HargaRow[];
  };

  const groups = new Map<string, Group>();
  for (const r of rows) {
    if (!r.kontrak) continue;
    const key = r.kontrak_id;
    if (!groups.has(key)) {
      groups.set(key, {
        kontrakId: r.kontrak.id,
        nomorKontrak: r.kontrak.nomor_kontrak,
        klienKode: r.kontrak.klien?.kode ?? "—",
        klienNama: r.kontrak.klien?.nama ?? "—",
        status: r.kontrak.status,
        items: [],
      });
    }
    groups.get(key)!.items.push(r);
  }
  const grouped = Array.from(groups.values()).sort((a, b) =>
    a.klienKode.localeCompare(b.klienKode)
  );

  const klienList = (klienResult.data ?? []) as { id: string; kode: string; nama: string }[];
  const alatList = (alatResult.data ?? []) as { id: string; kode: string; nama: string }[];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Harga Sewa"
        description="Daftar harga sewa per alat untuk semua kontrak. Edit harga dilakukan di halaman detail kontrak."
      />

      {/* Filter */}
      <form className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-40 space-y-1">
          <label className="text-xs font-medium text-slate-500">Klien</label>
          <select
            name="klien_id"
            defaultValue={filterKlien}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Semua klien</option>
            {klienList.map((k) => (
              <option key={k.id} value={k.id}>{k.kode} — {k.nama}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-40 space-y-1">
          <label className="text-xs font-medium text-slate-500">Alat</label>
          <select
            name="alat_id"
            defaultValue={filterAlat}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Semua alat</option>
            {alatList.map((a) => (
              <option key={a.id} value={a.id}>{a.kode} — {a.nama}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          Filter
        </button>
        {(filterKlien || filterAlat) && (
          <a href="/master/harga" className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2">
            Reset
          </a>
        )}
      </form>

      {/* Grouped list */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            Belum ada harga sewa{filterKlien || filterAlat ? " untuk filter ini" : ""}.
          </p>
          <Link href="/master/kontrak" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
            Buka Kontrak Sewa untuk set harga →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <div key={g.kontrakId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{g.klienKode}</span>
                    <span className="text-xs text-slate-500">— {g.klienNama}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      g.status === "AKTIF" ? "bg-emerald-50 text-emerald-700" :
                      g.status === "SELESAI" ? "bg-slate-100 text-slate-600" :
                      "bg-red-50 text-red-700"
                    }`}>
                      {g.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{g.nomorKontrak}</p>
                </div>
                <Link
                  href={`/master/kontrak/${g.kontrakId}`}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline shrink-0"
                >
                  Edit Kontrak
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {/* Items */}
              <div className="divide-y divide-slate-100">
                {g.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-slate-400 w-24 shrink-0">{item.alat?.kode}</span>
                      <span className="text-sm text-slate-700 truncate">{item.alat?.nama}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {item.locked ? (
                        <span title="Harga terkunci karena sudah ada transaksi" className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          <Lock className="w-3 h-3" />
                          Locked
                        </span>
                      ) : (
                        <span title="Harga belum terkunci" className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                          <Unlock className="w-3 h-3" />
                        </span>
                      )}
                      <span className="text-sm font-semibold text-slate-800 tabular-nums w-32 text-right">
                        {formatRupiah(item.harga_bulanan)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

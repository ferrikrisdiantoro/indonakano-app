"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type KlienOpt = { id: string; kode: string; nama: string };

export function RekapFilter({
  klienList,
  klienId,
  mulai,
  akhir,
}: {
  klienList: KlienOpt[];
  klienId: string;
  mulai: string;
  akhir: string;
}) {
  const router = useRouter();
  const [selKlien, setSelKlien] = useState(klienId);
  const [selMulai, setSelMulai] = useState(mulai);
  const [selAkhir, setSelAkhir] = useState(akhir);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selKlien || !selMulai || !selAkhir) return;
    const params = new URLSearchParams({
      klien_id: selKlien,
      mulai: selMulai,
      akhir: selAkhir,
    });
    router.push(`/rekap?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-end"
    >
      <div className="flex-1 min-w-40 space-y-1">
        <label className="text-xs font-medium text-slate-500">Proyek / Klien</label>
        <select
          value={selKlien}
          onChange={(e) => setSelKlien(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          required
        >
          <option value="">Pilih proyek…</option>
          {klienList.map((k) => (
            <option key={k.id} value={k.id}>
              {k.kode} — {k.nama}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500">Dari</label>
        <input
          type="date"
          value={selMulai}
          onChange={(e) => setSelMulai(e.target.value)}
          required
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500">Sampai</label>
        <input
          type="date"
          value={selAkhir}
          onChange={(e) => setSelAkhir(e.target.value)}
          required
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <button
        type="submit"
        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
      >
        Tampilkan Rekap
      </button>
    </form>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { roundHalfUp, calcHargaHarian } from "@/lib/utils";
import type { SatuanTagihan } from "@/types/database";

type ActionResult = { success: true; id?: string } | { success: false; error: string };

export interface GenerateTagihanData {
  klien_id: string;
  kontrak_id: string;
  periode_mulai: string;
  periode_akhir: string;
  override_periode: boolean;
  override_alasan: string;
}

// ── Generate tagihan ──────────────────────────────────────────

export async function generateTagihanAction(
  data: GenerateTagihanData
): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createClient();

  if (!data.klien_id) return { success: false, error: "Klien wajib dipilih" };
  if (!data.kontrak_id) return { success: false, error: "Kontrak wajib dipilih" };
  if (!data.periode_mulai || !data.periode_akhir)
    return { success: false, error: "Periode wajib diisi" };
  if (data.periode_akhir < data.periode_mulai)
    return { success: false, error: "Periode akhir harus setelah periode mulai" };

  // Fetch kontrak
  const { data: kontrak } = await supabase
    .from("kontrak_sewa")
    .select("id, klien_id, apply_ppn")
    .eq("id", data.kontrak_id)
    .single();
  if (!kontrak) return { success: false, error: "Kontrak tidak ditemukan" };

  type HargaItem = {
    alat_id: string;
    harga_bulanan: number;
    alat: { kode: string; nama: string } | null;
  };
  const { data: hargaRaw } = await supabase
    .from("harga_sewa")
    .select("alat_id, harga_bulanan, alat:alat_id(kode, nama)")
    .eq("kontrak_id", data.kontrak_id);
  const hargaList = (hargaRaw ?? []) as unknown as HargaItem[];
  if (!hargaList.length)
    return { success: false, error: "Tidak ada harga alat terdaftar di kontrak ini" };

  // Fetch PPN rate
  let ppnPersen = 0;
  if (kontrak.apply_ppn) {
    const { data: ppnRow } = await supabase
      .from("app_setting")
      .select("value")
      .eq("key", "ppn_default_persen")
      .single();
    ppnPersen = parseFloat(ppnRow?.value ?? "11");
  }

  // Fetch current stok_proyek for this klien
  type StokItem = { alat_id: string; qty: number };
  const { data: stokRaw } = await supabase
    .from("stok_proyek")
    .select("alat_id, qty")
    .eq("klien_id", data.klien_id);
  const stokMap = new Map<string, number>(
    ((stokRaw ?? []) as unknown as StokItem[]).map((s) => [s.alat_id, s.qty])
  );

  // Fetch approved transactions within period (for billing rows)
  type TxnRaw = {
    id: string;
    tipe: string;
    tanggal: string;
    klien_id: string | null;
    klien_tujuan_id: string | null;
    items: { alat_id: string; qty: number }[];
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: txnInRaw } = await (supabase as any)
    .from("transaksi")
    .select("id, tipe, tanggal, klien_id, klien_tujuan_id, items:transaksi_item(alat_id, qty)")
    .eq("status", "APPROVED")
    .in("tipe", ["PENGIRIMAN", "RETUR", "TRANSFER", "CLAIM"])
    .or(`klien_id.eq.${data.klien_id},klien_tujuan_id.eq.${data.klien_id}`)
    .gte("tanggal", data.periode_mulai)
    .lte("tanggal", data.periode_akhir);

  // Fetch approved transactions AFTER period (to compute stok at period end from current stok)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: txnAfterRaw } = await (supabase as any)
    .from("transaksi")
    .select("id, tipe, tanggal, klien_id, klien_tujuan_id, items:transaksi_item(alat_id, qty)")
    .eq("status", "APPROVED")
    .in("tipe", ["PENGIRIMAN", "RETUR", "TRANSFER", "CLAIM"])
    .or(`klien_id.eq.${data.klien_id},klien_tujuan_id.eq.${data.klien_id}`)
    .gt("tanggal", data.periode_akhir);

  const txnInPeriod = (txnInRaw ?? []) as TxnRaw[];
  const txnAfterPeriod = (txnAfterRaw ?? []) as TxnRaw[];

  // PENGIRIMAN / TRANSFER_IN = incoming; RETUR / CLAIM / TRANSFER_OUT = outgoing
  function isIncoming(txn: TxnRaw): boolean {
    if (txn.tipe === "TRANSFER") return txn.klien_tujuan_id === data.klien_id;
    return txn.tipe === "PENGIRIMAN";
  }

  // Adjustment map: how much to add to current stok to get stok at period end
  const afterAdj = new Map<string, number>();
  for (const txn of txnAfterPeriod) {
    const inc = isIncoming(txn);
    for (const item of txn.items) {
      const cur = afterAdj.get(item.alat_id) ?? 0;
      // If incoming after period → subtract from current to get period-end stok
      // If outgoing after period → add back to get period-end stok
      afterAdj.set(item.alat_id, cur + (inc ? -item.qty : item.qty));
    }
  }

  // Per-alat in-period events (incoming = alat masuk, outgoing = alat keluar)
  type Events = {
    incoming: { tanggal: string; qty: number }[];
    outgoing: { tanggal: string; qty: number }[];
  };
  const perAlatEvents = new Map<string, Events>();
  for (const txn of txnInPeriod) {
    const inc = isIncoming(txn);
    for (const item of txn.items) {
      if (!perAlatEvents.has(item.alat_id))
        perAlatEvents.set(item.alat_id, { incoming: [], outgoing: [] });
      const ev = perAlatEvents.get(item.alat_id)!;
      if (inc) ev.incoming.push({ tanggal: txn.tanggal, qty: item.qty });
      else ev.outgoing.push({ tanggal: txn.tanggal, qty: item.qty });
    }
  }

  const mulaiDate = new Date(data.periode_mulai + "T00:00:00Z");
  const akhirDate = new Date(data.periode_akhir + "T00:00:00Z");
  const totalDays =
    Math.round((akhirDate.getTime() - mulaiDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  // ≥28 days = full billing cycle → remaining stok billed as BL; <28 = short period → HR prorata
  const isFullMonth = totalDays >= 28;

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  const periodeTeksFull = `${fmtDate(mulaiDate)} – ${fmtDate(akhirDate)}`;

  const items: {
    alat_id: string;
    alat_nama: string;
    periode_teks: string;
    satuan: SatuanTagihan;
    qty: number;
    lama: number;
    harga_per_satuan_snapshot: number;
    total: number;
    ordering: number;
  }[] = [];

  let ordering = 0;

  for (const harga of hargaList) {
    const currentStok = stokMap.get(harga.alat_id) ?? 0;
    const adj = afterAdj.get(harga.alat_id) ?? 0;
    const stokAtPeriodEnd = Math.max(0, currentStok + adj);
    const events = perAlatEvents.get(harga.alat_id) ?? { incoming: [], outgoing: [] };

    if (stokAtPeriodEnd === 0 && events.incoming.length === 0 && events.outgoing.length === 0)
      continue;

    const hargaBulanan = harga.harga_bulanan;
    const hargaHarian = calcHargaHarian(hargaBulanan);
    const alatNama = harga.alat?.nama ?? "";

    // Remaining stok: BL for full-month period, HR prorata for short period
    if (stokAtPeriodEnd > 0) {
      if (isFullMonth) {
        items.push({
          alat_id: harga.alat_id,
          alat_nama: alatNama,
          periode_teks: periodeTeksFull,
          satuan: "BL",
          qty: stokAtPeriodEnd,
          lama: 1,
          harga_per_satuan_snapshot: hargaBulanan,
          total: roundHalfUp(stokAtPeriodEnd * hargaBulanan, 0),
          ordering: ordering++,
        });
      } else {
        items.push({
          alat_id: harga.alat_id,
          alat_nama: alatNama,
          periode_teks: periodeTeksFull,
          satuan: "HR",
          qty: stokAtPeriodEnd,
          lama: totalDays,
          harga_per_satuan_snapshot: hargaHarian,
          total: roundHalfUp(stokAtPeriodEnd * hargaHarian * totalDays, 0),
          ordering: ordering++,
        });
      }
    }

    // Outgoing mid-period: HR from period_mulai to day before outgoing_date
    for (const out of events.outgoing) {
      const outDate = new Date(out.tanggal + "T00:00:00Z");
      const lama = Math.round(
        (outDate.getTime() - mulaiDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (lama <= 0) continue;
      const outDateMinus1 = new Date(outDate.getTime() - 86_400_000);
      items.push({
        alat_id: harga.alat_id,
        alat_nama: alatNama,
        periode_teks: `${fmtDate(mulaiDate)} – ${fmtDate(outDateMinus1)}`,
        satuan: "HR",
        qty: out.qty,
        lama,
        harga_per_satuan_snapshot: hargaHarian,
        total: roundHalfUp(out.qty * hargaHarian * lama, 0),
        ordering: ordering++,
      });
    }

    // Incoming mid-period: HR from incoming_date to period_akhir (inclusive)
    for (const inc of events.incoming) {
      const incDate = new Date(inc.tanggal + "T00:00:00Z");
      const lama =
        Math.round((akhirDate.getTime() - incDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (lama <= 0) continue;
      items.push({
        alat_id: harga.alat_id,
        alat_nama: alatNama,
        periode_teks: `${fmtDate(incDate)} – ${fmtDate(akhirDate)}`,
        satuan: "HR",
        qty: inc.qty,
        lama,
        harga_per_satuan_snapshot: hargaHarian,
        total: roundHalfUp(inc.qty * hargaHarian * lama, 0),
        ordering: ordering++,
      });
    }
  }

  if (!items.length) {
    // Diagnostic: bantu admin tahu kenapa kosong
    const totalStokProyek = Array.from(stokMap.values()).reduce((a, b) => a + b, 0);
    const totalTrxInPeriod = txnInPeriod.length;

    let detail = "";
    if (totalTrxInPeriod === 0 && totalStokProyek === 0) {
      detail = "Klien belum punya transaksi APPROVED dan stok proyek = 0. Buat & approve PENGIRIMAN dulu sebelum generate tagihan.";
    } else if (totalTrxInPeriod === 0) {
      detail = `Tidak ada transaksi APPROVED di periode ${data.periode_mulai} – ${data.periode_akhir} (stok proyek saat ini ${totalStokProyek} unit, tapi semua pergerakan terjadi di luar periode). Coba ubah periode atau cek tanggal transaksi.`;
    } else {
      detail = `Ada ${totalTrxInPeriod} transaksi di periode ini, tapi tidak ada alat dari kontrak yang dipilih yang cocok. Cek apakah harga sewa untuk alat-alat tsb sudah terdaftar di kontrak.`;
    }

    return { success: false, error: `Tidak ada alat yang bisa ditagih: ${detail}` };
  }

  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const ppnAmount = roundHalfUp((subtotal * ppnPersen) / 100, 0);
  const total = subtotal + ppnAmount;

  const akhir = new Date(data.periode_akhir + "T00:00:00Z");
  const { data: nomor, error: nomorErr } = await supabase.rpc("get_next_nomor_tagihan", {
    p_bulan: akhir.getUTCMonth() + 1,
    p_tahun: akhir.getUTCFullYear(),
  });

  if (nomorErr || !nomor)
    return { success: false, error: nomorErr?.message ?? "Gagal generate nomor tagihan" };

  const { data: tagihan, error: tagihanErr } = await supabase
    .from("tagihan")
    .insert({
      nomor: nomor as string,
      kontrak_id: data.kontrak_id,
      klien_id: data.klien_id,
      periode_mulai: data.periode_mulai,
      periode_akhir: data.periode_akhir,
      override_periode: data.override_periode,
      override_alasan: data.override_alasan.trim() || null,
      subtotal,
      ppn_persen: ppnPersen,
      ppn_amount: ppnAmount,
      total,
      generated_by: userId,
    })
    .select("id")
    .single();

  if (tagihanErr || !tagihan)
    return { success: false, error: tagihanErr?.message ?? "Gagal membuat tagihan" };

  const { error: itemsErr } = await supabase
    .from("tagihan_item")
    .insert(items.map((i) => ({ ...i, tagihan_id: tagihan.id })));

  if (itemsErr) {
    // Rollback: hapus header tagihan yang sudah ter-insert.
    // Sama seperti rollback transaksi: cek hasilnya supaya tidak silent fail.
    const { data: rolledBack } = await supabase
      .from("tagihan")
      .delete()
      .eq("id", tagihan.id)
      .select();
    if (!rolledBack || rolledBack.length === 0) {
      console.warn(
        `[generateTagihanAction] Rollback failed: tagihan ${tagihan.id} tetap di DB. ` +
        `Pastikan migration 00005 (DELETE RLS policy) sudah dijalankan.`
      );
    }
    return { success: false, error: itemsErr.message };
  }

  await writeAudit(supabase, {
    userId,
    entityType: "tagihan",
    entityId: tagihan.id,
    action: "GENERATE",
    afterValue: { nomor: nomor as string, klien_id: data.klien_id, periode_mulai: data.periode_mulai, periode_akhir: data.periode_akhir, total },
  });

  revalidatePath("/tagihan");
  return { success: true, id: tagihan.id };
}

// ── Finalize tagihan ──────────────────────────────────────────

export async function finalizeTagihanAction(tagihanId: string): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createClient();

  // Ambil snapshot data tagihan dulu agar bisa dimasukkan ke audit log
  const { data: snapshot } = await supabase
    .from("tagihan")
    .select("nomor, klien_id, total, periode_mulai, periode_akhir")
    .eq("id", tagihanId)
    .single();

  const finalizedAt = new Date().toISOString();
  const { error } = await supabase
    .from("tagihan")
    .update({
      status: "FINAL",
      finalized_at: finalizedAt,
    })
    .eq("id", tagihanId)
    .eq("status", "DRAFT");

  if (error) return { success: false, error: error.message };

  await writeAudit(supabase, {
    userId,
    entityType: "tagihan",
    entityId: tagihanId,
    action: "FINALIZE",
    afterValue: {
      status: "FINAL",
      finalized_at: finalizedAt,
      nomor: snapshot?.nomor ?? null,
      klien_id: snapshot?.klien_id ?? null,
      total: snapshot?.total ?? null,
      periode: snapshot ? `${snapshot.periode_mulai} – ${snapshot.periode_akhir}` : null,
    },
  });

  revalidatePath("/tagihan");
  revalidatePath(`/tagihan/${tagihanId}`);
  return { success: true };
}

// ── Void tagihan ──────────────────────────────────────────────

export async function voidTagihanAction(
  tagihanId: string,
  reason: string
): Promise<ActionResult> {
  const userId = await requireAdmin();
  if (!reason.trim()) return { success: false, error: "Alasan void wajib diisi" };
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("void_tagihan", {
    p_tagihan_id: tagihanId,
    p_user_id: userId,
    p_reason: reason.trim(),
  });

  if (error) return { success: false, error: error.message };
  const result = data as { success: boolean; error?: string };
  if (!result.success) return { success: false, error: result.error ?? "Gagal void tagihan" };

  // Audit log sudah ditulis atomik di dalam SQL function void_tagihan
  // (action='VOID', after_value berisi status + reason).

  revalidatePath("/tagihan");
  revalidatePath(`/tagihan/${tagihanId}`);
  return { success: true };
}

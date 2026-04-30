"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

// Normalize kode for duplicate comparison: strip non-alphanumeric, uppercase.
// Treats "MF-170", "MF170", "mf 170" as the same kode.
function normalizeKode(s: string | null | undefined): string {
  return (s ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Normalize nama for duplicate comparison: trim, lowercase, collapse whitespace.
function normalizeNama(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

// ── Import Alat ───────────────────────────────────────────────

export interface AlatImportRow {
  kode: string;
  nama: string;
  satuan_default: string;
}

export async function importAlatAction(
  rows: AlatImportRow[]
): Promise<ActionResult<{ inserted: number; skipped: number; errors: string[] }>> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: existing } = await supabase.from("alat").select("kode, nama");
  const seenKodes = new Set(
    (existing ?? []).map((r: { kode: string; nama: string }) => normalizeKode(r.kode))
  );
  const seenNamas = new Set(
    (existing ?? []).map((r: { kode: string; nama: string }) => normalizeNama(r.nama))
  );

  const errors: string[] = [];
  const toInsert: AlatImportRow[] = [];

  for (const r of rows) {
    if (!r.kode || !r.nama) {
      errors.push(`Baris dilewati: kode/nama kosong`);
      continue;
    }
    const nKode = normalizeKode(r.kode);
    const nNama = normalizeNama(r.nama);
    if (seenKodes.has(nKode)) {
      errors.push(`Kode mirip sudah ada: ${r.kode} (cocok dengan alat lain)`);
      continue;
    }
    if (seenNamas.has(nNama)) {
      errors.push(`Nama sudah ada: ${r.nama} (kode upload: ${r.kode})`);
      continue;
    }
    seenKodes.add(nKode);
    seenNamas.add(nNama);
    toInsert.push(r);
  }

  const skipped = rows.length - toInsert.length;
  if (toInsert.length === 0) return { success: true, data: { inserted: 0, skipped, errors } };

  const { error } = await supabase.from("alat").insert(
    toInsert.map((r) => ({
      kode: r.kode.trim().toUpperCase(),
      nama: r.nama.trim(),
      satuan_default: r.satuan_default.trim() || "Unit",
      is_active: true,
    }))
  );

  if (error) return { success: false, error: error.message };
  revalidatePath("/master/alat");
  return { success: true, data: { inserted: toInsert.length, skipped, errors } };
}

// ── Import Klien ──────────────────────────────────────────────

export interface KlienImportRow {
  kode: string;
  nama: string;
  pic_nama: string;
  pic_kontak: string;
}

export async function importKlienAction(
  rows: KlienImportRow[]
): Promise<ActionResult<{ inserted: number; skipped: number; errors: string[] }>> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: existing } = await supabase.from("klien").select("kode, nama");
  const seenKodes = new Set(
    (existing ?? []).map((r: { kode: string; nama: string }) => normalizeKode(r.kode))
  );
  const seenNamas = new Set(
    (existing ?? []).map((r: { kode: string; nama: string }) => normalizeNama(r.nama))
  );

  const errors: string[] = [];
  const toInsert: KlienImportRow[] = [];

  for (const r of rows) {
    if (!r.kode || !r.nama) {
      errors.push(`Baris dilewati: kode/nama kosong`);
      continue;
    }
    const nKode = normalizeKode(r.kode);
    const nNama = normalizeNama(r.nama);
    if (seenKodes.has(nKode)) {
      errors.push(`Kode mirip sudah ada: ${r.kode}`);
      continue;
    }
    if (seenNamas.has(nNama)) {
      errors.push(`Nama sudah ada: ${r.nama} (kode upload: ${r.kode})`);
      continue;
    }
    seenKodes.add(nKode);
    seenNamas.add(nNama);
    toInsert.push(r);
  }

  const skipped = rows.length - toInsert.length;
  if (toInsert.length === 0) return { success: true, data: { inserted: 0, skipped, errors } };

  const { error } = await supabase.from("klien").insert(
    toInsert.map((r) => ({
      kode: r.kode.trim().toUpperCase(),
      nama: r.nama.trim(),
      pic_nama: r.pic_nama?.trim() || null,
      pic_kontak: r.pic_kontak?.trim() || null,
      is_active: true,
    }))
  );

  if (error) return { success: false, error: error.message };
  revalidatePath("/master/klien");
  return { success: true, data: { inserted: toInsert.length, skipped, errors } };
}

// ── Import Stok Gudang ────────────────────────────────────────

export interface StokGudangImportRow {
  kode_alat: string;
  qty: number;
}

export async function importStokGudangAction(
  rows: StokGudangImportRow[]
): Promise<ActionResult<{ upserted: number; errors: string[] }>> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: alatRaw } = await supabase.from("alat").select("id, kode");
  const alatByKode = new Map(
    (alatRaw ?? []).map((a: { id: string; kode: string }) => [normalizeKode(a.kode), a.id])
  );

  const errors: string[] = [];
  const toUpsert: { alat_id: string; qty_tersedia: number }[] = [];

  for (const row of rows) {
    const alatId = alatByKode.get(normalizeKode(row.kode_alat));
    if (!alatId) { errors.push(`Alat tidak ditemukan: ${row.kode_alat}`); continue; }
    if (isNaN(row.qty) || row.qty < 0) { errors.push(`Qty tidak valid: ${row.kode_alat}`); continue; }
    toUpsert.push({ alat_id: alatId, qty_tersedia: Math.round(row.qty) });
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("stok_gudang")
      .upsert(toUpsert, { onConflict: "alat_id" });
    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/gudang");
  return { success: true, data: { upserted: toUpsert.length, errors } };
}

// ── Import Stok Proyek ────────────────────────────────────────

export interface StokProyekImportRow {
  kode_klien: string;
  kode_alat: string;
  qty: number;
}

export async function importStokProyekAction(
  rows: StokProyekImportRow[]
): Promise<ActionResult<{ upserted: number; errors: string[] }>> {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: alatRaw }, { data: klienRaw }] = await Promise.all([
    supabase.from("alat").select("id, kode"),
    supabase.from("klien").select("id, kode"),
  ]);
  const alatByKode = new Map(
    (alatRaw ?? []).map((a: { id: string; kode: string }) => [normalizeKode(a.kode), a.id])
  );
  const klienByKode = new Map(
    (klienRaw ?? []).map((k: { id: string; kode: string }) => [normalizeKode(k.kode), k.id])
  );

  const errors: string[] = [];
  const toUpsert: { klien_id: string; alat_id: string; qty: number }[] = [];

  for (const row of rows) {
    const klienId = klienByKode.get(normalizeKode(row.kode_klien));
    const alatId = alatByKode.get(normalizeKode(row.kode_alat));
    if (!klienId) { errors.push(`Klien tidak ditemukan: ${row.kode_klien}`); continue; }
    if (!alatId) { errors.push(`Alat tidak ditemukan: ${row.kode_alat}`); continue; }
    if (isNaN(row.qty) || row.qty < 0) { errors.push(`Qty tidak valid: ${row.kode_klien}/${row.kode_alat}`); continue; }
    toUpsert.push({ klien_id: klienId, alat_id: alatId, qty: Math.round(row.qty) });
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("stok_proyek")
      .upsert(toUpsert, { onConflict: "klien_id,alat_id" });
    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/rekap");
  revalidatePath("/gudang");
  return { success: true, data: { upserted: toUpsert.length, errors } };
}

// ── Import Kontrak Sewa ───────────────────────────────────────

export interface KontrakImportRow {
  kode_klien: string;
  nomor_kontrak: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  apply_ppn: string;
  tgl_tutup_periode: string;
}

export async function importKontrakAction(
  rows: KontrakImportRow[]
): Promise<ActionResult<{ inserted: number; skipped: number; errors: string[] }>> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return { success: false, error: "Tidak terautentikasi" };

  const [{ data: klienRaw }, { data: existingKontrak }] = await Promise.all([
    supabase.from("klien").select("id, kode"),
    supabase.from("kontrak_sewa").select("nomor_kontrak"),
  ]);
  const klienByKode = new Map(
    (klienRaw ?? []).map((k: { id: string; kode: string }) => [normalizeKode(k.kode), k.id])
  );
  const existingNomor = new Set(
    (existingKontrak ?? []).map((k: { nomor_kontrak: string }) => k.nomor_kontrak)
  );

  const errors: string[] = [];
  const toInsert: {
    klien_id: string;
    nomor_kontrak: string;
    tanggal_mulai: string;
    tanggal_selesai: string | null;
    apply_ppn: boolean;
    tgl_tutup_periode_default: number | null;
    status: "AKTIF";
    created_by: string;
  }[] = [];
  let skipped = 0;

  for (const row of rows) {
    const nomor = row.nomor_kontrak?.trim();
    const kodeKlien = normalizeKode(row.kode_klien);
    if (!nomor || !kodeKlien) { errors.push(`Baris tidak lengkap: ${JSON.stringify(row)}`); continue; }
    if (existingNomor.has(nomor)) { skipped++; continue; }
    const klienId = klienByKode.get(kodeKlien);
    if (!klienId) { errors.push(`Klien tidak ditemukan: ${kodeKlien}`); continue; }
    if (!row.tanggal_mulai) { errors.push(`Tanggal mulai kosong: ${nomor}`); continue; }
    const applyPpn = String(row.apply_ppn).trim().toUpperCase() === "Y";
    const tglTutup = row.tgl_tutup_periode
      ? parseInt(String(row.tgl_tutup_periode), 10)
      : null;
    toInsert.push({
      klien_id: klienId,
      nomor_kontrak: nomor,
      tanggal_mulai: row.tanggal_mulai.trim(),
      tanggal_selesai: row.tanggal_selesai?.trim() || null,
      apply_ppn: applyPpn,
      tgl_tutup_periode_default: tglTutup && !isNaN(tglTutup) ? tglTutup : null,
      status: "AKTIF",
      created_by: userId,
    });
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("kontrak_sewa").insert(toInsert);
    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/master/kontrak");
  return { success: true, data: { inserted: toInsert.length, skipped, errors } };
}

// ── Import Harga Sewa ─────────────────────────────────────────

export interface HargaImportRow {
  nomor_kontrak: string;
  kode_alat: string;
  harga_bulanan: string;
}

export async function importHargaAction(
  rows: HargaImportRow[]
): Promise<ActionResult<{ upserted: number; errors: string[] }>> {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: kontrakRaw }, { data: alatRaw }] = await Promise.all([
    supabase.from("kontrak_sewa").select("id, nomor_kontrak"),
    supabase.from("alat").select("id, kode"),
  ]);
  const kontrakByNomor = new Map(
    (kontrakRaw ?? []).map((k: { id: string; nomor_kontrak: string }) => [k.nomor_kontrak, k.id])
  );
  const alatByKode = new Map(
    (alatRaw ?? []).map((a: { id: string; kode: string }) => [normalizeKode(a.kode), a.id])
  );

  const errors: string[] = [];
  const toUpsert: { kontrak_id: string; alat_id: string; harga_bulanan: number; locked: boolean }[] = [];

  for (const row of rows) {
    const nomor = row.nomor_kontrak?.trim();
    const kodeAlat = normalizeKode(row.kode_alat);
    const harga = parseFloat(String(row.harga_bulanan).replace(/[^\d.]/g, ""));
    if (!nomor || !kodeAlat) { errors.push(`Baris tidak lengkap`); continue; }
    const kontrakId = kontrakByNomor.get(nomor);
    if (!kontrakId) { errors.push(`Kontrak tidak ditemukan: ${nomor}`); continue; }
    const alatId = alatByKode.get(kodeAlat);
    if (!alatId) { errors.push(`Alat tidak ditemukan: ${row.kode_alat}`); continue; }
    if (isNaN(harga) || harga < 0) { errors.push(`Harga tidak valid: ${kodeAlat} / ${nomor}`); continue; }
    toUpsert.push({ kontrak_id: kontrakId, alat_id: alatId, harga_bulanan: harga, locked: false });
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("harga_sewa")
      .upsert(toUpsert, { onConflict: "kontrak_id,alat_id" });
    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/master/kontrak");
  revalidatePath("/master/harga");
  return { success: true, data: { upserted: toUpsert.length, errors } };
}

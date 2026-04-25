"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

type ActionResult = { success: true } | { success: false; error: string };

export async function upsertHargaSewaAction(
  kontrakId: string,
  alatId: string,
  hargaBulanan: number
): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createClient();

  if (hargaBulanan < 0) return { success: false, error: "Harga tidak boleh negatif" };

  // Check if locked
  const { data: existing } = await supabase
    .from("harga_sewa")
    .select("locked")
    .eq("kontrak_id", kontrakId)
    .eq("alat_id", alatId)
    .single();

  if (existing && (existing as { locked: boolean }).locked) {
    return {
      success: false,
      error: "Harga sudah dikunci karena sudah ada transaksi yang disetujui",
    };
  }

  const { error } = await supabase.from("harga_sewa").upsert(
    { kontrak_id: kontrakId, alat_id: alatId, harga_bulanan: hargaBulanan, locked: false },
    { onConflict: "kontrak_id,alat_id" }
  );

  if (error) return { success: false, error: error.message };

  await writeAudit(supabase, {
    userId,
    entityType: "harga_sewa",
    entityId: kontrakId,
    action: "UPSERT",
    afterValue: { alat_id: alatId, harga_bulanan: hargaBulanan },
  });

  revalidatePath(`/master/kontrak/${kontrakId}`);
  return { success: true };
}

export async function deleteHargaSewaAction(
  kontrakId: string,
  hargaId: string
): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("harga_sewa")
    .select("locked")
    .eq("id", hargaId)
    .single();

  if (existing && (existing as { locked: boolean }).locked) {
    return { success: false, error: "Harga sudah dikunci, tidak bisa dihapus" };
  }

  const { error } = await supabase.from("harga_sewa").delete().eq("id", hargaId);
  if (error) return { success: false, error: error.message };

  await writeAudit(supabase, {
    userId,
    entityType: "harga_sewa",
    entityId: hargaId,
    action: "DELETE",
    afterValue: { kontrak_id: kontrakId },
  });

  revalidatePath(`/master/kontrak/${kontrakId}`);
  return { success: true };
}

export async function bulkUpsertHargaSewaAction(
  kontrakId: string,
  items: { alat_id: string; harga_bulanan: number }[]
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const toInsert = items
    .filter((i) => i.harga_bulanan > 0)
    .map((i) => ({
      kontrak_id: kontrakId,
      alat_id: i.alat_id,
      harga_bulanan: i.harga_bulanan,
      locked: false,
    }));

  if (toInsert.length === 0) return { success: false, error: "Minimal 1 harga harus diisi" };

  const { error } = await supabase
    .from("harga_sewa")
    .upsert(toInsert, { onConflict: "kontrak_id,alat_id", ignoreDuplicates: false });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/master/kontrak/${kontrakId}`);
  return { success: true };
}

export async function updateKontrakDetailAction(
  id: string,
  data: {
    nomor_kontrak: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
    tgl_tutup_periode_default: string;
    apply_ppn: boolean;
    status: "AKTIF" | "SELESAI" | "DIBATALKAN";
  }
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("kontrak_sewa")
    .update({
      nomor_kontrak: data.nomor_kontrak.trim(),
      tanggal_mulai: data.tanggal_mulai,
      tanggal_selesai: data.tanggal_selesai || null,
      tgl_tutup_periode_default: data.tgl_tutup_periode_default
        ? parseInt(data.tgl_tutup_periode_default)
        : null,
      apply_ppn: data.apply_ppn,
      status: data.status,
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/master/kontrak");
  revalidatePath(`/master/kontrak/${id}`);
  return { success: true };
}

export async function duplicateKontrakAction(
  sourceId: string,
  nomorKontrak: string,
  tanggalMulai: string
): Promise<{ success: true; newId: string } | { success: false; error: string }> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return { success: false, error: "Tidak terautentikasi" };

  const { data: source } = await supabase
    .from("kontrak_sewa")
    .select("klien_id, apply_ppn, tgl_tutup_periode_default")
    .eq("id", sourceId)
    .single();

  if (!source) return { success: false, error: "Kontrak sumber tidak ditemukan" };

  const { data: newKontrak, error: insertError } = await supabase
    .from("kontrak_sewa")
    .insert({
      klien_id: (source as { klien_id: string }).klien_id,
      nomor_kontrak: nomorKontrak.trim(),
      tanggal_mulai: tanggalMulai,
      tanggal_selesai: null,
      apply_ppn: (source as { apply_ppn: boolean }).apply_ppn,
      tgl_tutup_periode_default: (source as { tgl_tutup_periode_default: number | null }).tgl_tutup_periode_default,
      status: "AKTIF",
      created_by: userId,
    })
    .select("id")
    .single();

  if (insertError || !newKontrak) return { success: false, error: insertError?.message ?? "Gagal membuat kontrak" };
  const newId = (newKontrak as { id: string }).id;

  // Copy harga_sewa
  const { data: srcHarga } = await supabase
    .from("harga_sewa")
    .select("alat_id, harga_bulanan")
    .eq("kontrak_id", sourceId);

  if (srcHarga && srcHarga.length > 0) {
    await supabase.from("harga_sewa").insert(
      (srcHarga as { alat_id: string; harga_bulanan: number }[]).map((h) => ({
        kontrak_id: newId,
        alat_id: h.alat_id,
        harga_bulanan: h.harga_bulanan,
        locked: false,
      }))
    );
  }

  await writeAudit(supabase, {
    userId,
    entityType: "kontrak_sewa",
    entityId: newId,
    action: "DUPLICATE",
    afterValue: { source_id: sourceId, nomor_kontrak: nomorKontrak },
  });

  revalidatePath("/master/kontrak");
  return { success: true, newId };
}

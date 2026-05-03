"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import type { TipeTransaksi } from "@/types/database";

type ActionResult = { success: true; id?: string } | { success: false; error: string };

export interface TransaksiFormData {
  tipe: TipeTransaksi;
  tanggal: string;
  klien_id: string | null;
  klien_tujuan_id: string | null;
  kontrak_id: string | null;
  no_sj: string;
  no_sj_operan: string;
  catatan: string;
  override_stok_minus: boolean;
  override_alasan: string;
  items: { alat_id: string; qty: number }[];
}

// Validate that retur/claim/transfer qty does not exceed current stok at proyek
async function validateStokProyek(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tipe: TipeTransaksi,
  klienId: string | null,
  items: { alat_id: string; qty: number }[]
): Promise<string | null> {
  if (!["RETUR", "CLAIM", "TRANSFER"].includes(tipe) || !klienId) return null;

  type StokItem = { alat_id: string; qty: number };
  const { data: stokRaw } = await supabase
    .from("stok_proyek")
    .select("alat_id, qty")
    .eq("klien_id", klienId)
    .in("alat_id", items.map((i) => i.alat_id));

  const stokMap = new Map<string, number>(
    ((stokRaw ?? []) as unknown as StokItem[]).map((s) => [s.alat_id, s.qty])
  );

  for (const item of items) {
    const stokProyek = stokMap.get(item.alat_id) ?? 0;
    if (item.qty > stokProyek) {
      return `Qty melebihi stok di proyek untuk satu atau lebih alat (stok tersedia: ${stokProyek})`;
    }
  }
  return null;
}

export async function createTransaksiAction(data: TransaksiFormData): Promise<ActionResult> {
  const { userId } = await requireAuth();
  const supabase = await createClient();

  if (!data.tipe) return { success: false, error: "Tipe transaksi wajib diisi" };
  if (!data.tanggal) return { success: false, error: "Tanggal wajib diisi" };
  if (data.tipe !== "STOCK_ADJUSTMENT" && !data.klien_id)
    return { success: false, error: "Klien wajib diisi" };
  if (data.tipe === "TRANSFER" && !data.klien_tujuan_id)
    return { success: false, error: "Klien tujuan wajib diisi untuk Transfer" };

  const requiresNoSj = data.tipe === "PENGIRIMAN" || data.tipe === "RETUR" || data.tipe === "TRANSFER";
  if (requiresNoSj && !data.no_sj.trim())
    return { success: false, error: "No. Surat Jalan wajib diisi untuk tipe ini" };
  if (data.tipe === "TRANSFER" && !data.no_sj_operan.trim())
    return { success: false, error: "No. SJ Operan wajib diisi untuk Transfer" };

  const validItems = data.items.filter((i) => i.alat_id && i.qty !== 0);
  if (!validItems.length) return { success: false, error: "Minimal 1 item alat wajib diisi" };

  const stokErr = await validateStokProyek(supabase, data.tipe, data.klien_id, validItems);
  if (stokErr) return { success: false, error: stokErr };

  const { data: inserted, error: hdrErr } = await supabase
    .from("transaksi")
    .insert({
      tipe: data.tipe,
      tanggal: data.tanggal,
      klien_id: data.klien_id,
      klien_tujuan_id: data.klien_tujuan_id,
      kontrak_id: data.kontrak_id,
      no_sj: data.no_sj.trim() || null,
      no_sj_operan: data.no_sj_operan.trim() || null,
      catatan: data.catatan.trim() || null,
      override_stok_minus: data.override_stok_minus,
      override_alasan: data.override_alasan.trim() || null,
      status: "PENDING_APPROVAL" as const,
      created_by: userId,
    })
    .select("id")
    .single();

  if (hdrErr || !inserted)
    return { success: false, error: hdrErr?.message ?? "Gagal membuat transaksi" };

  const { error: itemErr } = await supabase.from("transaksi_item").insert(
    validItems.map((i) => ({
      transaksi_id: inserted.id,
      alat_id: i.alat_id,
      qty: i.qty,
    }))
  );

  if (itemErr) {
    await supabase.from("transaksi").delete().eq("id", inserted.id);
    return { success: false, error: itemErr.message };
  }

  await writeAudit(supabase, {
    userId,
    entityType: "transaksi",
    entityId: inserted.id,
    action: "CREATE",
    afterValue: {
      tipe: data.tipe,
      tanggal: data.tanggal,
      klien_id: data.klien_id,
      override_stok_minus: data.override_stok_minus,
      ...(data.override_stok_minus && data.override_alasan.trim()
        ? { override_alasan: data.override_alasan.trim() }
        : {}),
    },
  });

  revalidatePath("/transaksi");
  revalidatePath("/transaksi/pending");
  return { success: true, id: inserted.id };
}

export async function editTransaksiAction(
  transaksiId: string,
  data: TransaksiFormData
): Promise<ActionResult> {
  const { userId } = await requireAuth();
  const supabase = await createClient();

  if (!data.tipe) return { success: false, error: "Tipe transaksi wajib diisi" };
  if (!data.tanggal) return { success: false, error: "Tanggal wajib diisi" };
  if (data.tipe !== "STOCK_ADJUSTMENT" && !data.klien_id)
    return { success: false, error: "Klien wajib diisi" };
  if (data.tipe === "TRANSFER" && !data.klien_tujuan_id)
    return { success: false, error: "Klien tujuan wajib diisi untuk Transfer" };

  const requiresNoSj = data.tipe === "PENGIRIMAN" || data.tipe === "RETUR" || data.tipe === "TRANSFER";
  if (requiresNoSj && !data.no_sj.trim())
    return { success: false, error: "No. Surat Jalan wajib diisi untuk tipe ini" };
  if (data.tipe === "TRANSFER" && !data.no_sj_operan.trim())
    return { success: false, error: "No. SJ Operan wajib diisi untuk Transfer" };

  const validItems = data.items.filter((i) => i.alat_id && i.qty !== 0);
  if (!validItems.length) return { success: false, error: "Minimal 1 item alat wajib diisi" };

  // Verify still PENDING
  const { data: existing } = await supabase
    .from("transaksi")
    .select("id, status")
    .eq("id", transaksiId)
    .single();
  if (!existing) return { success: false, error: "Transaksi tidak ditemukan" };
  if (existing.status !== "PENDING_APPROVAL")
    return { success: false, error: "Hanya transaksi PENDING yang bisa diedit" };

  const stokErr = await validateStokProyek(supabase, data.tipe, data.klien_id, validItems);
  if (stokErr) return { success: false, error: stokErr };

  const { error: hdrErr } = await supabase
    .from("transaksi")
    .update({
      tipe: data.tipe,
      tanggal: data.tanggal,
      klien_id: data.klien_id,
      klien_tujuan_id: data.klien_tujuan_id,
      kontrak_id: data.kontrak_id,
      no_sj: data.no_sj.trim() || null,
      no_sj_operan: data.no_sj_operan.trim() || null,
      catatan: data.catatan.trim() || null,
      override_stok_minus: data.override_stok_minus,
      override_alasan: data.override_alasan.trim() || null,
    })
    .eq("id", transaksiId)
    .eq("status", "PENDING_APPROVAL");

  if (hdrErr) return { success: false, error: hdrErr.message };

  // Replace items atomically
  const { error: delErr } = await supabase
    .from("transaksi_item")
    .delete()
    .eq("transaksi_id", transaksiId);
  if (delErr) return { success: false, error: delErr.message };

  const { error: itemErr } = await supabase.from("transaksi_item").insert(
    validItems.map((i) => ({
      transaksi_id: transaksiId,
      alat_id: i.alat_id,
      qty: i.qty,
    }))
  );
  if (itemErr) return { success: false, error: itemErr.message };

  await writeAudit(supabase, {
    userId,
    entityType: "transaksi",
    entityId: transaksiId,
    action: "EDIT",
    afterValue: {
      tipe: data.tipe,
      tanggal: data.tanggal,
      klien_id: data.klien_id,
      override_stok_minus: data.override_stok_minus,
      ...(data.override_stok_minus && data.override_alasan.trim()
        ? { override_alasan: data.override_alasan.trim() }
        : {}),
    },
  });

  revalidatePath("/transaksi");
  revalidatePath("/transaksi/pending");
  revalidatePath(`/transaksi/${transaksiId}`);
  return { success: true };
}

export async function approveTransaksiAction(transaksiId: string): Promise<ActionResult> {
  // Admin & Checker keduanya bisa approve transaksi orang lain.
  // Self-approval di-block oleh SQL function approve_transaksi (segregation of duties).
  const { userId } = await requireAuth();
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("approve_transaksi", {
    p_transaksi_id: transaksiId,
    p_checker_id: userId,
  });

  if (error) return { success: false, error: error.message };
  const result = data as { success: boolean; error?: string };
  if (!result.success) return { success: false, error: result.error ?? "Gagal menyetujui" };

  await writeAudit(supabase, {
    userId,
    entityType: "transaksi",
    entityId: transaksiId,
    action: "APPROVE",
  });

  revalidatePath("/transaksi");
  revalidatePath("/transaksi/pending");
  revalidatePath(`/transaksi/${transaksiId}`);
  revalidatePath("/gudang");
  return { success: true };
}

export async function rejectTransaksiAction(
  transaksiId: string,
  reason: string
): Promise<ActionResult> {
  const { userId } = await requireAuth();
  if (!reason.trim()) return { success: false, error: "Alasan penolakan wajib diisi" };
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("reject_transaksi", {
    p_transaksi_id: transaksiId,
    p_checker_id: userId,
    p_reason: reason.trim(),
  });

  if (error) return { success: false, error: error.message };
  const result = data as { success: boolean; error?: string };
  if (!result.success) return { success: false, error: result.error ?? "Gagal menolak" };

  await writeAudit(supabase, {
    userId,
    entityType: "transaksi",
    entityId: transaksiId,
    action: "REJECT",
    afterValue: { reason },
  });

  revalidatePath("/transaksi");
  revalidatePath("/transaksi/pending");
  revalidatePath(`/transaksi/${transaksiId}`);
  return { success: true };
}

export async function saveAttachmentAction(
  transaksiId: string,
  fileUrl: string,
  fileName: string,
  fileSize: number
): Promise<ActionResult> {
  const { userId } = await requireAuth();
  const supabase = await createClient();

  const { error } = await supabase.from("transaksi_attachment").insert({
    transaksi_id: transaksiId,
    file_url: fileUrl,
    file_name: fileName,
    file_size: fileSize,
    uploaded_by: userId,
  });

  if (error) return { success: false, error: error.message };
  revalidatePath(`/transaksi/${transaksiId}`);
  return { success: true };
}

export async function deleteAttachmentAction(attachmentId: string, transaksiId: string): Promise<ActionResult> {
  await requireAuth();
  const supabase = await createClient();

  const { error } = await supabase
    .from("transaksi_attachment")
    .delete()
    .eq("id", attachmentId);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/transaksi/${transaksiId}`);
  return { success: true };
}

export async function voidTransaksiAction(
  transaksiId: string,
  reason: string
): Promise<ActionResult> {
  const userId = await requireAdmin();
  if (!reason.trim()) return { success: false, error: "Alasan void wajib diisi" };
  const supabase = await createClient();

  const { error } = await supabase
    .from("transaksi")
    .update({
      status: "VOID",
      void_reason: reason.trim(),
      void_by: userId,
      void_at: new Date().toISOString(),
    })
    .eq("id", transaksiId)
    .eq("status", "PENDING_APPROVAL");

  if (error) return { success: false, error: error.message };

  await writeAudit(supabase, {
    userId,
    entityType: "transaksi",
    entityId: transaksiId,
    action: "VOID",
    afterValue: { reason },
  });

  revalidatePath("/transaksi");
  revalidatePath("/transaksi/pending");
  revalidatePath(`/transaksi/${transaksiId}`);
  return { success: true };
}

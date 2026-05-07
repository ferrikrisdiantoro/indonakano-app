"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

type ActionResult = { success: true; id?: string } | { success: false; error: string };

export interface KontrakFormData {
  klien_id: string;
  nomor_kontrak: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  tgl_tutup_periode_default: string;
  apply_ppn: boolean;
}

export async function createKontrakAction(data: KontrakFormData): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createClient();

  if (!data.klien_id || !data.nomor_kontrak || !data.tanggal_mulai) {
    return { success: false, error: "Klien, nomor kontrak, dan tanggal mulai wajib diisi" };
  }

  const tutup = data.tgl_tutup_periode_default
    ? parseInt(data.tgl_tutup_periode_default)
    : null;

  const { data: inserted, error } = await supabase
    .from("kontrak_sewa")
    .insert({
      klien_id: data.klien_id,
      nomor_kontrak: data.nomor_kontrak.trim(),
      tanggal_mulai: data.tanggal_mulai,
      tanggal_selesai: data.tanggal_selesai || null,
      tgl_tutup_periode_default: tutup,
      apply_ppn: data.apply_ppn,
      status: "AKTIF" as const,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505")
      return { success: false, error: "Nomor kontrak sudah ada untuk klien ini" };
    return { success: false, error: error.message };
  }

  await writeAudit(supabase, {
    userId,
    entityType: "kontrak_sewa",
    entityId: inserted.id,
    action: "CREATE",
    afterValue: { nomor_kontrak: data.nomor_kontrak, klien_id: data.klien_id },
  });

  revalidatePath("/master/kontrak");
  return { success: true, id: inserted.id };
}

export async function updateKontrakAction(
  id: string,
  data: Pick<KontrakFormData, "nomor_kontrak" | "tanggal_mulai" | "tanggal_selesai" | "tgl_tutup_periode_default" | "apply_ppn">
): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createClient();

  const tutup = data.tgl_tutup_periode_default
    ? parseInt(data.tgl_tutup_periode_default)
    : null;

  const { error } = await supabase
    .from("kontrak_sewa")
    .update({
      nomor_kontrak: data.nomor_kontrak.trim(),
      tanggal_mulai: data.tanggal_mulai,
      tanggal_selesai: data.tanggal_selesai || null,
      tgl_tutup_periode_default: tutup,
      apply_ppn: data.apply_ppn,
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  await writeAudit(supabase, {
    userId,
    entityType: "kontrak_sewa",
    entityId: id,
    action: "UPDATE",
    afterValue: { nomor_kontrak: data.nomor_kontrak },
  });

  revalidatePath("/master/kontrak");
  revalidatePath(`/master/kontrak/${id}`);
  return { success: true };
}

export async function updateKontrakStatusAction(
  id: string,
  status: "AKTIF" | "SELESAI" | "DIBATALKAN"
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("kontrak_sewa")
    .update({ status })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/master/kontrak");
  revalidatePath(`/master/kontrak/${id}`);
  return { success: true };
}

/** Duplicate a contract: creates a new DRAFT contract with same harga (unlocked) */
export async function duplicateKontrakAction(sourceId: string): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createClient();

  const { data: source, error: srcErr } = await supabase
    .from("kontrak_sewa")
    .select("*, harga_sewa(*)")
    .eq("id", sourceId)
    .single();

  if (srcErr || !source) return { success: false, error: "Kontrak sumber tidak ditemukan" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sourceTyped = source as any as {
    klien_id: string;
    nomor_kontrak: string;
    tanggal_mulai: string;
    tanggal_selesai: string | null;
    tgl_tutup_periode_default: number | null;
    apply_ppn: boolean;
    harga_sewa: { alat_id: string; harga_bulanan: number }[];
  };

  const { data: newKontrak, error: insErr } = await supabase
    .from("kontrak_sewa")
    .insert({
      klien_id: sourceTyped.klien_id,
      nomor_kontrak: `${sourceTyped.nomor_kontrak}-COPY`,
      tanggal_mulai: new Date().toISOString().split("T")[0],
      tanggal_selesai: null,
      tgl_tutup_periode_default: sourceTyped.tgl_tutup_periode_default,
      apply_ppn: sourceTyped.apply_ppn,
      status: "AKTIF" as const,
      created_by: userId,
    })
    .select("id")
    .single();

  if (insErr || !newKontrak) return { success: false, error: insErr?.message ?? "Gagal duplikat" };

  if (sourceTyped.harga_sewa.length > 0) {
    await supabase.from("harga_sewa").insert(
      sourceTyped.harga_sewa.map((h) => ({
        kontrak_id: newKontrak.id,
        alat_id: h.alat_id,
        harga_bulanan: h.harga_bulanan,
        locked: false,
      }))
    );
  }

  await writeAudit(supabase, {
    userId,
    entityType: "kontrak_sewa",
    entityId: newKontrak.id,
    action: "DUPLICATE",
    afterValue: {
      source_id: sourceId,
      source_nomor: sourceTyped.nomor_kontrak,
      new_nomor: `${sourceTyped.nomor_kontrak}-COPY`,
      klien_id: sourceTyped.klien_id,
      copied_harga_count: sourceTyped.harga_sewa.length,
    },
  });

  revalidatePath("/master/kontrak");
  redirect(`/master/kontrak/${newKontrak.id}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

type ActionResult = { success: true } | { success: false; error: string };

export interface KlienFormData {
  kode: string;
  nama: string;
  pic_nama: string;
  pic_kontak: string;
}

export async function createKlienAction(data: KlienFormData): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createClient();

  const kode = data.kode.trim().toUpperCase();
  const nama = data.nama.trim();

  if (!kode || !nama) return { success: false, error: "Kode dan nama wajib diisi" };

  const { data: inserted, error } = await supabase
    .from("klien")
    .insert({
      kode,
      nama,
      pic_nama: data.pic_nama.trim() || null,
      pic_kontak: data.pic_kontak.trim() || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { success: false, error: "Kode klien sudah digunakan" };
    return { success: false, error: error.message };
  }

  await writeAudit(supabase, {
    userId,
    entityType: "klien",
    entityId: inserted?.id,
    action: "CREATE",
    afterValue: { kode, nama },
  });

  revalidatePath("/master/klien");
  return { success: true };
}

export async function updateKlienAction(
  id: string,
  data: KlienFormData
): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createClient();

  const kode = data.kode.trim().toUpperCase();
  const nama = data.nama.trim();

  if (!kode || !nama) return { success: false, error: "Kode dan nama wajib diisi" };

  const { error } = await supabase
    .from("klien")
    .update({
      kode,
      nama,
      pic_nama: data.pic_nama.trim() || null,
      pic_kontak: data.pic_kontak.trim() || null,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { success: false, error: "Kode klien sudah digunakan" };
    return { success: false, error: error.message };
  }

  await writeAudit(supabase, {
    userId,
    entityType: "klien",
    entityId: id,
    action: "UPDATE",
    afterValue: { kode, nama },
  });

  revalidatePath("/master/klien");
  return { success: true };
}

export async function toggleKlienActiveAction(
  id: string,
  is_active: boolean
): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("klien").update({ is_active }).eq("id", id);
  if (error) return { success: false, error: error.message };

  await writeAudit(supabase, {
    userId,
    entityType: "klien",
    entityId: id,
    action: is_active ? "ACTIVATE" : "DEACTIVATE",
  });

  revalidatePath("/master/klien");
  return { success: true };
}

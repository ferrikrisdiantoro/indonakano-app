"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

type ActionResult = { success: true } | { success: false; error: string };

export interface AlatFormData {
  kode: string;
  nama: string;
  satuan_default: string;
}

export async function createAlatAction(data: AlatFormData): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createClient();

  const kode = data.kode.trim().toUpperCase();
  const nama = data.nama.trim();
  const satuan = data.satuan_default.trim() || "unit";

  if (!kode || !nama) return { success: false, error: "Kode dan nama wajib diisi" };

  const { data: inserted, error } = await supabase
    .from("alat")
    .insert({ kode, nama, satuan_default: satuan, is_active: true })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { success: false, error: "Kode alat sudah digunakan" };
    return { success: false, error: error.message };
  }

  await writeAudit(supabase, {
    userId,
    entityType: "alat",
    entityId: inserted?.id,
    action: "CREATE",
    afterValue: { kode, nama, satuan_default: satuan },
  });

  revalidatePath("/master/alat");
  return { success: true };
}

export async function updateAlatAction(
  id: string,
  data: AlatFormData
): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createClient();

  const kode = data.kode.trim().toUpperCase();
  const nama = data.nama.trim();
  const satuan = data.satuan_default.trim() || "unit";

  if (!kode || !nama) return { success: false, error: "Kode dan nama wajib diisi" };

  const { error } = await supabase
    .from("alat")
    .update({ kode, nama, satuan_default: satuan })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { success: false, error: "Kode alat sudah digunakan" };
    return { success: false, error: error.message };
  }

  await writeAudit(supabase, {
    userId,
    entityType: "alat",
    entityId: id,
    action: "UPDATE",
    afterValue: { kode, nama, satuan_default: satuan },
  });

  revalidatePath("/master/alat");
  return { success: true };
}

export async function toggleAlatActiveAction(
  id: string,
  is_active: boolean
): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("alat")
    .update({ is_active })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  await writeAudit(supabase, {
    userId,
    entityType: "alat",
    entityId: id,
    action: is_active ? "ACTIVATE" : "DEACTIVATE",
    afterValue: { is_active },
  });

  revalidatePath("/master/alat");
  return { success: true };
}

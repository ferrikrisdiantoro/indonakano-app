"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

type ActionResult = { success: true } | { success: false; error: string };

export async function updateFormatTagihanAction(data: {
  prefix: string;
  next_seq: number;
}): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createClient();

  if (!data.prefix.trim()) return { success: false, error: "Prefix tidak boleh kosong" };
  if (data.next_seq < 1) return { success: false, error: "Nomor urut minimal 1" };

  const counterValue = String(data.next_seq - 1);

  const { error } = await supabase.from("app_setting").upsert(
    [
      { key: "prefix_nomor_tagihan", value: data.prefix.trim().toUpperCase() },
      { key: "counter_tagihan", value: counterValue },
    ],
    { onConflict: "key" }
  );

  if (error) return { success: false, error: error.message };

  await writeAudit(supabase, {
    userId,
    entityType: "app_setting",
    entityId: null,
    action: "UPDATE_FORMAT_TAGIHAN",
    afterValue: { prefix: data.prefix.trim().toUpperCase(), next_seq: data.next_seq },
  });

  revalidatePath("/pengaturan/format-tagihan");
  return { success: true };
}

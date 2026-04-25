import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TagihanListClient } from "./_components/tagihan-list-client";

export const metadata: Metadata = { title: "Tagihan" };

export default async function TagihanPage() {
  const { role } = await requireAuth();
  const supabase = await createClient();

  const [tagihanResult, klienResult, kontrakResult] = await Promise.all([
    supabase
      .from("tagihan")
      .select(
        "id, nomor, status, total, subtotal, ppn_persen, ppn_amount, periode_mulai, periode_akhir, generated_at, finalized_at, klien:klien_id(kode, nama), kontrak:kontrak_id(nomor_kontrak)"
      )
      .order("generated_at", { ascending: false })
      .limit(200),
    supabase
      .from("klien")
      .select("id, kode, nama")
      .eq("is_active", true)
      .order("kode"),
    supabase
      .from("kontrak_sewa")
      .select("id, klien_id, nomor_kontrak, tgl_tutup_periode_default")
      .eq("status", "AKTIF"),
  ]);

  return (
    <TagihanListClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tagihanList={(tagihanResult.data ?? []) as any}
      isAdmin={role === "ADMIN"}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      klienList={(klienResult.data ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      kontrakList={(kontrakResult.data ?? []) as any}
    />
  );
}

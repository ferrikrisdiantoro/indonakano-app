import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TagihanDetailClient } from "../_components/tagihan-detail-client";

export const metadata: Metadata = { title: "Detail Tagihan" };

export default async function TagihanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { role } = await requireAuth();
  const { id } = await params;
  const supabase = await createClient();

  const { data: tagihanBase } = await supabase
    .from("tagihan")
    .select(
      "id, nomor, status, periode_mulai, periode_akhir, override_periode, override_alasan, subtotal, ppn_persen, ppn_amount, total, void_reason, generated_at, finalized_at, klien:klien_id(kode, nama), kontrak:kontrak_id(nomor_kontrak)"
    )
    .eq("id", id)
    .single();

  if (!tagihanBase) notFound();

  // Separate query for multi-FK user joins to avoid TS never inference
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tagihanRels: any = await (supabase as any)
    .from("tagihan")
    .select("generated_by_user:generated_by(nama), void_by_user:void_by(nama)")
    .eq("id", id)
    .single();

  const { data: items } = await supabase
    .from("tagihan_item")
    .select(
      "id, alat_id, alat_nama, periode_teks, satuan, qty, lama, harga_per_satuan_snapshot, total, ordering"
    )
    .eq("tagihan_id", id)
    .order("ordering");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tagihan = { ...(tagihanBase as any), ...(tagihanRels?.data ?? {}) };

  return (
    <TagihanDetailClient
      tagihan={tagihan}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items={(items ?? []) as any}
      isAdmin={role === "ADMIN"}
    />
  );
}

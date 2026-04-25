import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TransaksiDetailClient } from "./_components/transaksi-detail-client";

export const metadata: Metadata = { title: "Detail Transaksi" };

export default async function TransaksiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId, role } = await requireAuth();
  const { id } = await params;
  const supabase = await createClient();

  // Separate from Promise.all to avoid multi-FK join collapsing to never
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: trx } = await (supabase as any)
    .from("transaksi")
    .select(
      "*, klien:klien_id(kode, nama), klien_tujuan:klien_tujuan_id(kode, nama), kontrak:kontrak_id(nomor_kontrak), created_by_user:created_by(nama), approved_by_user:approved_by(nama), rejected_by_user:rejected_by(nama), void_by_user:void_by(nama), items:transaksi_item(id, alat_id, qty, alat:alat_id(kode, nama, satuan_default))"
    )
    .eq("id", id)
    .single();

  if (!trx) notFound();

  const [klienResult, alatResult, kontrakResult, attachmentResult] = await Promise.all([
    supabase.from("klien").select("id, kode, nama").eq("is_active", true).order("kode"),
    supabase
      .from("alat")
      .select("id, kode, nama, satuan_default")
      .eq("is_active", true)
      .order("kode"),
    supabase
      .from("kontrak_sewa")
      .select("id, klien_id, nomor_kontrak")
      .eq("status", "AKTIF"),
    supabase
      .from("transaksi_attachment")
      .select("id, file_url, file_name, file_size, uploaded_at")
      .eq("transaksi_id", id)
      .order("uploaded_at"),
  ]);

  return (
    <TransaksiDetailClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transaksi={trx as any}
      currentUserId={userId}
      isChecker={role === "CHECKER"}
      isAdmin={role === "ADMIN"}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      klienList={(klienResult.data ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      alatList={(alatResult.data ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      kontrakList={(kontrakResult.data ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attachments={(attachmentResult.data ?? []) as any}
    />
  );
}

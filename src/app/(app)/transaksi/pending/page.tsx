import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PendingClient } from "./_components/pending-client";

export const metadata: Metadata = { title: "Menunggu Persetujuan" };

export default async function PendingPage() {
  await requireAuth();
  const supabase = await createClient();

  const { data: pendingList } = await supabase
    .from("transaksi")
    .select(
      "id, tipe, tanggal, no_sj, status, created_at, klien:klien_id(kode, nama), klien_tujuan:klien_tujuan_id(kode, nama), created_by_user:created_by(nama)"
    )
    .eq("status", "PENDING_APPROVAL")
    .order("created_at", { ascending: false });

  return (
    <PendingClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pendingList={(pendingList ?? []) as any}
    />
  );
}

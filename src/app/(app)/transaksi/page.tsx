import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TransaksiListClient } from "./_components/transaksi-list-client";

export const metadata: Metadata = { title: "Transaksi" };

export default async function TransaksiPage() {
  const { role } = await requireAuth();
  const supabase = await createClient();

  const [trxResult, klienResult, alatResult, kontrakResult] = await Promise.all([
    supabase
      .from("transaksi")
      .select(
        "id, tipe, tanggal, no_sj, status, created_at, klien:klien_id(kode, nama), klien_tujuan:klien_tujuan_id(kode, nama), created_by_user:created_by(nama), items:transaksi_item(alat_id)"
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("klien")
      .select("id, kode, nama")
      .eq("is_active", true)
      .order("kode"),
    supabase
      .from("alat")
      .select("id, kode, nama, satuan_default")
      .eq("is_active", true)
      .order("kode"),
    supabase
      .from("kontrak_sewa")
      .select("id, klien_id, nomor_kontrak")
      .eq("status", "AKTIF"),
  ]);

  return (
    <TransaksiListClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transaksiList={(trxResult.data ?? []) as any}
      isAdmin={role === "ADMIN"}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      klienList={(klienResult.data ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      alatList={(alatResult.data ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      kontrakList={(kontrakResult.data ?? []) as any}
    />
  );
}

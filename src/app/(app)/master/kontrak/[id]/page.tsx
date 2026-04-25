import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { KontrakDetailClient } from "./_components/kontrak-detail-client";

export const metadata: Metadata = { title: "Detail Kontrak" };

export default async function KontrakDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: kontrak }, { data: hargaList }, { data: alatList }] =
    await Promise.all([
      supabase
        .from("kontrak_sewa")
        .select("*, klien:klien_id(kode, nama)")
        .eq("id", id)
        .single(),
      supabase
        .from("harga_sewa")
        .select("id, alat_id, harga_bulanan, locked, alat:alat_id(kode, nama)")
        .eq("kontrak_id", id)
        .order("alat_id"),
      supabase
        .from("alat")
        .select("id, kode, nama")
        .eq("is_active", true)
        .order("kode"),
    ]);

  if (!kontrak) notFound();

  return (
    <KontrakDetailClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      kontrak={kontrak as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hargaList={(hargaList ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      alatList={(alatList ?? []) as any}
    />
  );
}

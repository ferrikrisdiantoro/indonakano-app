import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { KontrakClientPage } from "./_components/kontrak-client-page";

export const metadata: Metadata = { title: "Kontrak Sewa" };

export default async function MasterKontrakPage() {
  await requireAdmin();

  const supabase = await createClient();

  const [{ data: kontrak }, { data: klien }] = await Promise.all([
    supabase
      .from("kontrak_sewa")
      .select("*, klien:klien_id(kode, nama)")
      .order("created_at", { ascending: false }),
    supabase
      .from("klien")
      .select("id, kode, nama")
      .eq("is_active", true)
      .order("kode"),
  ]);

  return (
    <KontrakClientPage
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data={(kontrak ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      klienList={(klien ?? []) as any}
    />
  );
}

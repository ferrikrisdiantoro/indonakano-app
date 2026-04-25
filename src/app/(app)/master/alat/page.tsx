import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { AlatRow } from "@/types/database";
import { AlatClientPage } from "./_components/alat-client-page";

export const metadata: Metadata = { title: "Master Alat" };

export default async function MasterAlatPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from("alat")
    .select("*")
    .order("kode", { ascending: true });

  return <AlatClientPage data={(data ?? []) as AlatRow[]} />;
}

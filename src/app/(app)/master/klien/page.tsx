import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { KlienRow } from "@/types/database";
import { KlienClientPage } from "./_components/klien-client-page";

export const metadata: Metadata = { title: "Master Klien" };

export default async function MasterKlienPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from("klien")
    .select("*")
    .order("kode", { ascending: true });

  return <KlienClientPage data={(data ?? []) as KlienRow[]} />;
}

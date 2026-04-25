import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { FormatTagihanClientPage } from "./_components/format-tagihan-client-page";

export const metadata: Metadata = { title: "Format Tagihan" };

export default async function FormatTagihanPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("app_setting")
    .select("key, value")
    .in("key", ["prefix_nomor_tagihan", "counter_tagihan"]);

  const settingMap = new Map((settings ?? []).map((s) => [s.key, s.value]));

  const prefix = settingMap.get("prefix_nomor_tagihan") ?? "PPA";
  const counter = parseInt(settingMap.get("counter_tagihan") ?? "0");
  const nextSeq = counter + 1;

  return <FormatTagihanClientPage prefix={prefix} nextSeq={nextSeq} />;
}

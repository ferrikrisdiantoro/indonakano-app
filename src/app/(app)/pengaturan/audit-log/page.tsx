import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AuditLogClient } from "./_components/audit-log-client";

export const metadata: Metadata = { title: "Audit Log" };

export default async function AuditLogPage() {
  await requireAdmin();
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase as any)
    .from("audit_log")
    .select(
      "id, user_id, entity_type, entity_id, action, after_value, created_at, user:user_id(nama, role)"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <AuditLogClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows={(rows ?? []) as any}
    />
  );
}

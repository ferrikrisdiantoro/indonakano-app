import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type AuditParams = {
  userId: string;
  entityType: string;
  entityId?: string | null;
  action: string;
  afterValue?: Record<string, unknown>;
};

/**
 * Write an immutable audit log entry. Silently ignores errors so it never
 * breaks the calling action.
 */
export async function writeAudit(
  supabase: SupabaseClient<Database>,
  params: AuditParams
): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      user_id: params.userId,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      action: params.action,
      before_value: null,
      after_value: params.afterValue ?? null,
      ip_address: null,
    });
  } catch {
    // Audit log failures must never break the primary action
  }
}

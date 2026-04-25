import type { Metadata } from "next";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { UserClientPage } from "./_components/user-client-page";

export const metadata: Metadata = { title: "Manajemen Pengguna" };

export default async function PengaturanUserPage() {
  const currentUserId = await requireAdmin();

  const [supabase, adminClient] = await Promise.all([
    createClient(),
    createAdminClient(),
  ]);

  const [{ data: profiles }, { data: authUsersData }] = await Promise.all([
    supabase.from("users").select("id, nama, role, is_active").order("nama"),
    adminClient.auth.admin.listUsers(),
  ]);

  const emailMap = new Map(
    (authUsersData?.users ?? []).map((u) => [u.id, u.email ?? ""])
  );

  const users = (profiles ?? []).map((p) => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(p as any),
    email: emailMap.get(p.id) ?? "",
  }));

  return <UserClientPage users={users} currentUserId={currentUserId} />;
}

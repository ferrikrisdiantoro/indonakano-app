import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";
import { AppShell } from "@/components/layout/app-shell";

interface UserProfile {
  nama: string;
  role: UserRole;
  is_active: boolean;
}

async function getPendingCount(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { count } = await supabase
    .from("transaksi")
    .select("*", { count: "exact", head: true })
    .eq("status", "PENDING_APPROVAL");
  return count ?? 0;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Profile fetch + pending count run in parallel — saves ~50-100ms per nav
  const [profileResult, pendingCount] = await Promise.all([
    supabase.from("users").select("nama, role, is_active").eq("id", user.id).single(),
    getPendingCount(supabase),
  ]);

  const profile = profileResult.data as UserProfile | null;

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <AppShell
      userName={profile.nama}
      userRole={profile.role}
      pendingCount={pendingCount}
    >
      {children}
    </AppShell>
  );
}

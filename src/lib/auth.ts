import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/database";

interface AuthUser {
  userId: string;
  role: UserRole;
}

interface UserProfile {
  role: UserRole;
  is_active: boolean;
}

/** Require any authenticated, active user. Redirects to /login if not. */
export async function requireAuth(): Promise<AuthUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("users")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  const profile = data as UserProfile | null;

  if (!profile || !profile.is_active) redirect("/login");

  return { userId: user.id, role: profile.role };
}

/** Require ADMIN role. Redirects to /dashboard if Checker tries to access. */
export async function requireAdmin(): Promise<string> {
  const { userId, role } = await requireAuth();
  if (role !== "ADMIN") redirect("/dashboard");
  return userId;
}

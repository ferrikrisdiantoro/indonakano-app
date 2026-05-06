"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

type ActionResult = { success: true } | { success: false; error: string };

export async function createUserAction(data: {
  email: string;
  password: string;
  nama: string;
  role: "ADMIN" | "CHECKER";
}): Promise<ActionResult> {
  const userId = await requireAdmin();
  const adminClient = await createAdminClient();
  const supabase = await createClient();

  const { data: authUser, error: authError } =
    await adminClient.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });

  if (authError || !authUser.user) {
    return { success: false, error: authError?.message ?? "Gagal membuat akun" };
  }

  const { error: profileError } = await adminClient
    .from("users")
    .update({ nama: data.nama, role: data.role })
    .eq("id", authUser.user.id);

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authUser.user.id);
    return { success: false, error: profileError.message };
  }

  await writeAudit(supabase, {
    userId,
    entityType: "users",
    entityId: authUser.user.id,
    action: "CREATE_USER",
    afterValue: { email: data.email, nama: data.nama, role: data.role },
  });

  revalidatePath("/pengaturan/user");
  return { success: true };
}

export async function updateUserAction(
  targetUserId: string,
  data: { nama: string; role: "ADMIN" | "CHECKER" }
): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("users")
    .update({ nama: data.nama, role: data.role })
    .eq("id", targetUserId);

  if (error) return { success: false, error: error.message };

  await writeAudit(supabase, {
    userId,
    entityType: "users",
    entityId: targetUserId,
    action: "UPDATE_USER",
    afterValue: { nama: data.nama, role: data.role },
  });

  revalidatePath("/pengaturan/user");
  return { success: true };
}

export async function resetPasswordAction(
  targetUserId: string,
  newPassword: string
): Promise<ActionResult> {
  const userId = await requireAdmin();

  if (newPassword.length < 8) {
    return { success: false, error: "Password minimal 8 karakter" };
  }

  const adminClient = await createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
    password: newPassword,
  });

  if (error) return { success: false, error: error.message };

  const supabase = await createClient();

  // Ambil nama user untuk konteks audit (jangan log password!)
  const { data: target } = await supabase
    .from("users")
    .select("nama, email")
    .eq("id", targetUserId)
    .single();

  await writeAudit(supabase, {
    userId,
    entityType: "users",
    entityId: targetUserId,
    action: "RESET_PASSWORD",
    afterValue: {
      target_nama: target?.nama ?? null,
      target_email: target?.email ?? null,
      // password TIDAK disimpan ke audit log untuk alasan keamanan
    },
  });

  return { success: true };
}

export async function toggleUserActiveAction(
  targetUserId: string,
  isActive: boolean
): Promise<ActionResult> {
  const userId = await requireAdmin();

  if (targetUserId === userId) {
    return { success: false, error: "Tidak dapat menonaktifkan akun sendiri" };
  }

  const adminClient = await createAdminClient();

  const { error: authError } = await adminClient.auth.admin.updateUserById(
    targetUserId,
    { ban_duration: isActive ? "none" : "876600h" }
  );

  if (authError) return { success: false, error: authError.message };

  const { error } = await adminClient
    .from("users")
    .update({ is_active: isActive })
    .eq("id", targetUserId);

  if (error) return { success: false, error: error.message };

  const supabase = await createClient();

  const { data: target } = await supabase
    .from("users")
    .select("nama, email, role")
    .eq("id", targetUserId)
    .single();

  await writeAudit(supabase, {
    userId,
    entityType: "users",
    entityId: targetUserId,
    action: isActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
    afterValue: {
      is_active: isActive,
      target_nama: target?.nama ?? null,
      target_email: target?.email ?? null,
      target_role: target?.role ?? null,
    },
  });

  revalidatePath("/pengaturan/user");
  return { success: true };
}

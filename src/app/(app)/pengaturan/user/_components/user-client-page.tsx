"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Key, UserCheck, UserX } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createUserAction,
  updateUserAction,
  resetPasswordAction,
  toggleUserActiveAction,
} from "../actions";

interface UserRow {
  id: string;
  nama: string;
  role: "ADMIN" | "CHECKER";
  is_active: boolean;
  email?: string;
}

// ── Create User Dialog ────────────────────────────────────────

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nama, setNama] = useState("");
  const [role, setRole] = useState<"ADMIN" | "CHECKER">("CHECKER");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createUserAction({ email, password, nama, role });
      if (!result.success) toast.error(result.error);
      else {
        toast.success("Pengguna berhasil dibuat");
        onOpenChange(false);
        setEmail(""); setPassword(""); setNama(""); setRole("CHECKER");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tambah Pengguna</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nama Lengkap</Label>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} required disabled={isPending} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isPending} />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min. 8 karakter"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "CHECKER")}
              disabled={isPending}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="CHECKER">Checker</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Batal</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Membuat…" : "Buat Pengguna"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit User Dialog ──────────────────────────────────────────

function EditUserDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: UserRow;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nama, setNama] = useState(user.nama);
  const [role, setRole] = useState<"ADMIN" | "CHECKER">(user.role);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateUserAction(user.id, { nama, role });
      if (!result.success) toast.error(result.error);
      else {
        toast.success("Data pengguna diperbarui");
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Pengguna</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nama Lengkap</Label>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} required disabled={isPending} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "CHECKER")}
              disabled={isPending}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="CHECKER">Checker</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Batal</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Menyimpan…" : "Simpan"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Reset Password Dialog ─────────────────────────────────────

function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  userName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await resetPasswordAction(userId, password);
      if (!result.success) toast.error(result.error);
      else {
        toast.success(`Password ${userName} berhasil direset`);
        onOpenChange(false);
        setPassword("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Password — {userName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Password Baru</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min. 8 karakter"
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Batal</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Mereset…" : "Reset Password"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────

export function UserClientPage({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openCreate, setOpenCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [toggleTarget, setToggleTarget] = useState<UserRow | null>(null);

  function handleToggle() {
    if (!toggleTarget) return;
    startTransition(async () => {
      const result = await toggleUserActiveAction(toggleTarget.id, !toggleTarget.is_active);
      if (!result.success) toast.error(result.error);
      else {
        toast.success(toggleTarget.is_active ? "Pengguna dinonaktifkan" : "Pengguna diaktifkan");
        router.refresh();
      }
      setToggleTarget(null);
    });
  }

  return (
    <>
      <PageHeader
        title="Manajemen Pengguna"
        description={`${users.filter((u) => u.is_active).length} pengguna aktif · ${users.length} total`}
        action={
          <Button onClick={() => setOpenCreate(true)} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Tambah Pengguna
          </Button>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead className="w-32">Role</TableHead>
              <TableHead className="w-20 text-center">Status</TableHead>
              <TableHead className="w-32 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{u.nama}</p>
                    {u.email && <p className="text-xs text-slate-400">{u.email}</p>}
                    {u.id === currentUserId && (
                      <span className="text-xs text-blue-500 font-medium">Anda</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    u.role === "ADMIN"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-slate-100 text-slate-600"
                  }`}>
                    {u.role === "ADMIN" ? "Admin" : "Checker"}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge active={u.is_active} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Edit"
                      onClick={() => setEditUser(u)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Reset Password"
                      onClick={() => setResetUser(u)}
                    >
                      <Key className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title={u.is_active ? "Nonaktifkan" : "Aktifkan"}
                      disabled={u.id === currentUserId}
                      onClick={() => setToggleTarget(u)}
                    >
                      {u.is_active
                        ? <UserX className="w-3.5 h-3.5 text-red-400" />
                        : <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                      }
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CreateUserDialog open={openCreate} onOpenChange={setOpenCreate} />

      {editUser && (
        <EditUserDialog
          open={!!editUser}
          onOpenChange={(v) => !v && setEditUser(null)}
          user={editUser}
        />
      )}

      {resetUser && (
        <ResetPasswordDialog
          open={!!resetUser}
          onOpenChange={(v) => !v && setResetUser(null)}
          userId={resetUser.id}
          userName={resetUser.nama}
        />
      )}

      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(v) => !v && setToggleTarget(null)}
        title={toggleTarget?.is_active ? "Nonaktifkan Pengguna?" : "Aktifkan Pengguna?"}
        description={
          toggleTarget?.is_active
            ? `"${toggleTarget?.nama}" tidak akan bisa login. Anda dapat mengaktifkan kembali kapan saja.`
            : `"${toggleTarget?.nama}" akan dapat login kembali.`
        }
        confirmLabel={toggleTarget?.is_active ? "Nonaktifkan" : "Aktifkan"}
        variant={toggleTarget?.is_active ? "destructive" : "default"}
        onConfirm={handleToggle}
        loading={isPending}
      />
    </>
  );
}

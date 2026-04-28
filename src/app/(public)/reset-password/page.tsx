"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const supabase = createClient();

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setInvalid(true);
        else setReady(true);
      });
    } else {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setReady(true);
        else setInvalid(true);
      });
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Password tidak cocok");
      return;
    }
    if (password.length < 8) {
      toast.error("Password minimal 8 karakter");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error("Gagal mengubah password", { description: error.message });
      setLoading(false);
      return;
    }
    toast.success("Password berhasil diubah, silakan login kembali");
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (invalid) {
    return (
      <div className="text-center space-y-4">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Link reset tidak valid atau sudah kadaluarsa. Silakan minta link baru.
        </div>
        <a href="/login" className="text-sm text-blue-600 hover:underline">
          ← Kembali ke Login
        </a>
      </div>
    );
  }

  if (!ready) {
    return (
      <p className="text-sm text-slate-500 text-center">Memverifikasi link…</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
          Password Baru
        </label>
        <input
          id="new-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimal 8 karakter"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          disabled={loading}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700">
          Konfirmasi Password
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Ulangi password baru"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          disabled={loading}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? "Menyimpan…" : "Simpan Password Baru"}
      </button>
      <a href="/login" className="block text-center text-sm text-slate-500 hover:text-slate-700">
        ← Kembali ke Login
      </a>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 mb-4">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-slate-900">PT Perancah Pro Alat</h1>
        <p className="text-sm text-slate-500 mt-1">Sistem Manajemen Sewa Perancah</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-5">Buat Password Baru</h2>
        <Suspense fallback={<p className="text-sm text-slate-500 text-center">Memuat…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
    </div>
  );
}

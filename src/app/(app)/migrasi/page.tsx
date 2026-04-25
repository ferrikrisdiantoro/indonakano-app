import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { MigrasiClient } from "./_components/migrasi-client";

export const metadata: Metadata = { title: "Migrasi Data" };

export default async function MigrasiPage() {
  const { role } = await requireAuth();
  if (role !== "ADMIN") {
    return (
      <div className="text-sm text-slate-500 p-4">
        Hanya Admin yang dapat mengakses halaman ini.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Migrasi Data</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Import data historis dari Excel ke sistem. Gunakan template yang tersedia.
        </p>
      </div>
      <MigrasiClient />
    </div>
  );
}

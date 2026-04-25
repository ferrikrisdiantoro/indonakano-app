"use client";

import { usePathname } from "next/navigation";

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/gudang": "Stok Gudang",
  "/transaksi": "Transaksi",
  "/transaksi/pending": "Pending Approval",
  "/rekap": "Rekap Stok",
  "/tagihan": "Tagihan",
  "/master/alat": "Master Alat",
  "/master/klien": "Master Klien",
  "/master/kontrak": "Kontrak Sewa",
  "/master/harga": "Harga Sewa",
  "/pengaturan/user": "Pengguna",
  "/pengaturan/format-tagihan": "Format Tagihan",
};

function getPageTitle(pathname: string): string {
  // Exact match first
  if (routeLabels[pathname]) return routeLabels[pathname];

  // Dynamic route: /transaksi/[id]
  if (/^\/transaksi\/[^/]+$/.test(pathname)) return "Detail Transaksi";
  if (/^\/tagihan\/[^/]+$/.test(pathname)) return "Detail Tagihan";

  return "PT INDONAKANO";
}

interface SiteHeaderProps {
  mobileMenuSlot?: React.ReactNode;
}

export function SiteHeader({ mobileMenuSlot }: SiteHeaderProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 h-14 px-4 lg:px-6 bg-white border-b border-slate-200 shrink-0">
      {/* Mobile menu button */}
      <div className="lg:hidden">{mobileMenuSlot}</div>

      {/* Page title */}
      <h1 className="text-sm font-semibold text-slate-800 flex-1">{title}</h1>
    </header>
  );
}

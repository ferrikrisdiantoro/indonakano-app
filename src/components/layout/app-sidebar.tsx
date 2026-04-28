"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";
import {
  LayoutDashboard,
  Package,
  ArrowRightLeft,
  Clock,
  BarChart3,
  FileText,
  Database,
  Wrench,
  Building2,
  FileSignature,
  Tag,
  Settings,
  Users,
  FileCode2,
  ChevronRight,
  LogOut,
  X,
  FolderInput,
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: Omit<NavItem, "children">[];
  badge?: number;
  adminOnly?: boolean;
}

function buildNav(role: UserRole, pendingCount: number): NavItem[] {
  const adminNav: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Stok Gudang", href: "/gudang", icon: Package },
    {
      label: "Transaksi",
      icon: ArrowRightLeft,
      children: [
        { label: "Semua Transaksi", href: "/transaksi", icon: ArrowRightLeft },
        { label: "Pending Approval", href: "/transaksi/pending", icon: Clock, badge: pendingCount },
      ],
    },
    { label: "Rekap Stok", href: "/rekap", icon: BarChart3 },
    { label: "Tagihan", href: "/tagihan", icon: FileText },
    {
      label: "Master Data",
      icon: Database,
      adminOnly: true,
      children: [
        { label: "Alat", href: "/master/alat", icon: Wrench },
        { label: "Klien", href: "/master/klien", icon: Building2 },
        { label: "Kontrak Sewa", href: "/master/kontrak", icon: FileSignature },
        { label: "Harga Sewa", href: "/master/harga", icon: Tag },
      ],
    },
    { label: "Migrasi Data", href: "/migrasi", icon: FolderInput, adminOnly: true },
    {
      label: "Pengaturan",
      icon: Settings,
      adminOnly: true,
      children: [
        { label: "Pengguna", href: "/pengaturan/user", icon: Users },
        { label: "Format Tagihan", href: "/pengaturan/format-tagihan", icon: FileCode2 },
      ],
    },
  ];

  const checkerNav: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Pending Approval", href: "/transaksi/pending", icon: Clock, badge: pendingCount },
    { label: "Semua Transaksi", href: "/transaksi", icon: ArrowRightLeft },
    { label: "Rekap Stok", href: "/rekap", icon: BarChart3 },
    { label: "Tagihan", href: "/tagihan", icon: FileText },
  ];

  return role === "ADMIN" ? adminNav : checkerNav;
}

function NavItemRow({ item, depth = 0, onNavigate }: { item: NavItem; depth?: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(() => {
    if (!item.children) return false;
    return item.children.some((c) => c.href && pathname.startsWith(c.href));
  });

  const isActive = item.href ? pathname === item.href || pathname.startsWith(item.href + "/") : false;

  if (item.children) {
    const hasActiveChild = item.children.some((c) => c.href && (pathname === c.href || pathname.startsWith(c.href + "/")));
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all",
            hasActiveChild ? "text-slate-900 font-semibold" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
            depth > 0 && "pl-8"
          )}
        >
          <item.icon className={cn("w-4 h-4 shrink-0", hasActiveChild ? "text-blue-600" : "text-slate-400")} />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronRight
            className={cn("w-3.5 h-3.5 transition-transform text-slate-400", open && "rotate-90")}
          />
        </button>
        {open && (
          <div className="mt-0.5 space-y-0.5">
            {item.children.map((child) => (
              <NavItemRow key={child.href} item={child} depth={depth + 1} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all",
        isActive
          ? "bg-blue-50 text-blue-700 font-semibold"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
        depth > 0 && "pl-8"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-blue-600" />
      )}
      <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-blue-600" : "text-slate-400")} />
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold",
            isActive ? "bg-blue-600 text-white" : "bg-orange-500 text-white"
          )}
        >
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
    </Link>
  );
}

function SidebarContent({
  userName,
  userRole,
  pendingCount,
  onClose,
}: {
  userName: string;
  userRole: UserRole;
  pendingCount: number;
  onClose?: () => void;
}) {
  const router = useRouter();
  const navItems = buildNav(userRole, pendingCount);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Berhasil logout");
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Header — Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18" />
            </svg>
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">PT INDONAKANO</p>
            <p className="text-[10px] text-slate-400">Sewa Perancah</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Menu Utama
        </p>
        {navItems.map((item) => (
          <NavItemRow key={item.href ?? item.label} item={item} onNavigate={onClose} />
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-slate-50">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 uppercase shadow-sm">
            {userName.slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{userName}</p>
            <p className="text-[10px] text-slate-500">
              {userRole === "ADMIN" ? "Administrator" : "Checker"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
            className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface AppSidebarProps {
  userName: string;
  userRole: UserRole;
  pendingCount: number;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function AppSidebar({ userName, userRole, pendingCount, mobileOpen, onMobileClose }: AppSidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0">
        <SidebarContent userName={userName} userRole={userRole} pendingCount={pendingCount} />
      </aside>

      {/* Mobile: overlay + slide-in drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity lg:hidden",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onMobileClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-300 ease-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent
          userName={userName}
          userRole={userRole}
          pendingCount={pendingCount}
          onClose={onMobileClose}
        />
      </div>
    </>
  );
}

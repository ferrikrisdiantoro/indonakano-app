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
  Menu,
  X,
  FolderInput,
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ── Nav types ────────────────────────────────────────────────

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: Omit<NavItem, "children">[];
  badge?: number;
  adminOnly?: boolean;
}

// ── Nav definitions ──────────────────────────────────────────

function buildNav(role: UserRole, pendingCount: number): NavItem[] {
  const adminNav: NavItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Stok Gudang",
      href: "/gudang",
      icon: Package,
    },
    {
      label: "Transaksi",
      icon: ArrowRightLeft,
      children: [
        { label: "Semua Transaksi", href: "/transaksi", icon: ArrowRightLeft },
        {
          label: "Pending Approval",
          href: "/transaksi/pending",
          icon: Clock,
          badge: pendingCount,
        },
      ],
    },
    {
      label: "Rekap Stok",
      href: "/rekap",
      icon: BarChart3,
    },
    {
      label: "Tagihan",
      href: "/tagihan",
      icon: FileText,
    },
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
    {
      label: "Migrasi Data",
      href: "/migrasi",
      icon: FolderInput,
      adminOnly: true,
    },
    {
      label: "Pengaturan",
      icon: Settings,
      adminOnly: true,
      children: [
        { label: "Pengguna", href: "/pengaturan/user", icon: Users },
        {
          label: "Format Tagihan",
          href: "/pengaturan/format-tagihan",
          icon: FileCode2,
        },
      ],
    },
  ];

  const checkerNav: NavItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Pending Approval",
      href: "/transaksi/pending",
      icon: Clock,
      badge: pendingCount,
    },
    {
      label: "Semua Transaksi",
      href: "/transaksi",
      icon: ArrowRightLeft,
    },
    {
      label: "Rekap Stok",
      href: "/rekap",
      icon: BarChart3,
    },
    {
      label: "Tagihan",
      href: "/tagihan",
      icon: FileText,
    },
  ];

  return role === "ADMIN" ? adminNav : checkerNav;
}

// ── Nav item component ────────────────────────────────────────

function NavItemRow({
  item,
  depth = 0,
}: {
  item: NavItem;
  depth?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(() => {
    if (!item.children) return false;
    return item.children.some((c) => c.href && pathname.startsWith(c.href));
  });

  const isActive = item.href ? pathname === item.href || pathname.startsWith(item.href + "/") : false;

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
            "text-slate-400 hover:text-slate-100 hover:bg-slate-700/60",
            depth > 0 && "pl-8"
          )}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left font-medium">{item.label}</span>
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 transition-transform text-slate-500",
              open && "rotate-90"
            )}
          />
        </button>
        {open && (
          <div className="mt-0.5 space-y-0.5">
            {item.children.map((child) => (
              <NavItemRow key={child.href} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
        isActive
          ? "bg-blue-600 text-white font-medium"
          : "text-slate-400 hover:text-slate-100 hover:bg-slate-700/60",
        depth > 0 && "pl-8"
      )}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold",
            isActive
              ? "bg-white/20 text-white"
              : "bg-orange-500 text-white"
          )}
        >
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
    </Link>
  );
}

// ── Sidebar content ───────────────────────────────────────────

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
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18"
              />
            </svg>
          </div>
          <div className="leading-tight">
            <p className="text-xs font-semibold text-slate-100 truncate max-w-[140px]">
              PT INDONAKANO
            </p>
            <p className="text-[10px] text-slate-500">Sewa Perancah</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {navItems.map((item) => (
          <NavItemRow key={item.href ?? item.label} item={item} />
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-slate-700/60 px-3 py-3">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-semibold text-slate-200 shrink-0 uppercase">
            {userName.slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">{userName}</p>
            <p className="text-[10px] text-slate-500">
              {userRole === "ADMIN" ? "Administrator" : "Checker"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="text-slate-500 hover:text-slate-200 p-1 rounded transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────

interface AppSidebarProps {
  userName: string;
  userRole: UserRole;
  pendingCount: number;
}

export function AppSidebar({ userName, userRole, pendingCount }: AppSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0">
        <SidebarContent
          userName={userName}
          userRole={userRole}
          pendingCount={pendingCount}
        />
      </aside>

      {/* Mobile: hamburger trigger in header */}
      <div className="lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 text-slate-600 hover:text-slate-900"
          aria-label="Buka menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile: overlay + drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">
            <SidebarContent
              userName={userName}
              userRole={userRole}
              pendingCount={pendingCount}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { AppSidebar } from "./app-sidebar";
import { SiteHeader } from "./site-header";
import type { UserRole } from "@/types/database";

interface AppShellProps {
  userName: string;
  userRole: UserRole;
  pendingCount: number;
  children: React.ReactNode;
}

export function AppShell({ userName, userRole, pendingCount, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <AppSidebar
        userName={userName}
        userRole={userRole}
        pendingCount={pendingCount}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <SiteHeader
          mobileMenuSlot={
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu"
              className="p-2 -ml-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          }
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}

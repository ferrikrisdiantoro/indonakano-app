import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  className?: string;
}

export function StatusBadge({
  active,
  activeLabel = "Aktif",
  inactiveLabel = "Nonaktif",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500",
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-slate-400"
        )}
      />
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

interface KontrakStatusBadgeProps {
  status: "AKTIF" | "SELESAI" | "DIBATALKAN";
}

export function KontrakStatusBadge({ status }: KontrakStatusBadgeProps) {
  const config = {
    AKTIF: { label: "Aktif", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    SELESAI: { label: "Selesai", className: "bg-blue-50 text-blue-700 border border-blue-200" },
    DIBATALKAN: { label: "Dibatalkan", className: "bg-red-50 text-red-600 border border-red-200" },
  };
  const { label, className } = config[status];
  return (
    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", className)}>
      {label}
    </span>
  );
}

interface TransaksiStatusBadgeProps {
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "VOID";
}

export function TransaksiStatusBadge({ status }: TransaksiStatusBadgeProps) {
  const config = {
    PENDING_APPROVAL: { label: "Menunggu", className: "bg-orange-50 text-orange-700 border border-orange-200" },
    APPROVED: { label: "Disetujui", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    REJECTED: { label: "Ditolak", className: "bg-red-50 text-red-600 border border-red-200" },
    VOID: { label: "Void", className: "bg-slate-100 text-slate-500 border border-slate-200" },
  };
  const { label, className } = config[status];
  return (
    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", className)}>
      {label}
    </span>
  );
}

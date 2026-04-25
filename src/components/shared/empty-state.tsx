import { InboxIcon } from "lucide-react";

interface EmptyStateProps {
  message?: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  message = "Tidak ada data",
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <InboxIcon className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-600">{message}</p>
      {description && (
        <p className="text-xs text-slate-400 mt-1 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

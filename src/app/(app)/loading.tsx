export default function Loading() {
  return (
    <div className="space-y-5 sm:space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="space-y-2">
          <div className="h-6 w-40 bg-slate-200 rounded" />
          <div className="h-4 w-64 bg-slate-100 rounded" />
        </div>
        <div className="h-9 w-28 bg-slate-200 rounded-md" />
      </div>

      {/* Generic content skeleton — works for tables, dashboards, forms */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="h-3 w-20 bg-slate-100 rounded" />
                <div className="h-7 w-12 bg-slate-200 rounded" />
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="h-4 w-32 bg-slate-200 rounded" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between">
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 w-3/4 bg-slate-200 rounded" />
                <div className="h-3 w-1/2 bg-slate-100 rounded" />
              </div>
              <div className="h-6 w-20 bg-slate-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141923] p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="skeleton-shimmer h-5 w-20 rounded-full" />
            <div className="skeleton-shimmer h-5 w-24 rounded-full" />
          </div>
          <div className="skeleton-shimmer mb-3 h-6 w-3/4 rounded-lg" />
          <div className="flex gap-2">
            <div className="skeleton-shimmer h-5 w-20 rounded-md" />
            <div className="skeleton-shimmer h-5 w-24 rounded-md" />
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-3.5">
            <div className="skeleton-shimmer h-4 w-24 rounded-md" />
            <div className="skeleton-shimmer h-4 w-14 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TournamentViewSkeleton() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-8">
      <div className="skeleton-shimmer mb-4 h-9 w-40 rounded-xl" />

      <div className="mb-6 rounded-2xl border border-white/[0.08] bg-[#141923] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex gap-2">
              <div className="skeleton-shimmer h-6 w-28 rounded-full" />
              <div className="skeleton-shimmer h-6 w-24 rounded-full" />
            </div>
            <div className="skeleton-shimmer h-9 w-64 max-w-full rounded-xl" />
            <div className="flex gap-2">
              <div className="skeleton-shimmer h-6 w-28 rounded-xl" />
              <div className="skeleton-shimmer h-6 w-24 rounded-xl" />
            </div>
          </div>
          <div className="skeleton-shimmer h-28 w-full rounded-2xl lg:w-72" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-white/[0.08] bg-[#141923] p-5 lg:col-span-8">
          <div className="mb-5 flex gap-3 border-b border-white/[0.06] pb-3">
            <div className="skeleton-shimmer h-8 w-20 rounded-xl" />
            <div className="skeleton-shimmer h-8 w-28 rounded-xl" />
            <div className="skeleton-shimmer h-8 w-20 rounded-xl" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="skeleton-shimmer h-12 w-full rounded-xl" />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#141923] p-5 lg:col-span-4">
          <div className="skeleton-shimmer mb-4 h-6 w-36 rounded-lg" />
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((p) => (
              <div key={p} className="skeleton-shimmer h-14 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
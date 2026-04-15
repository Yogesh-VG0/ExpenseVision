"use client";

export default function DashboardLoading() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 animate-pulse">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-48 rounded-lg bg-muted/40" />
        <div className="mt-2 h-4 w-72 rounded bg-muted/30" />
      </div>

      {/* Stats cards skeleton */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card/50 p-6"
          >
            <div className="h-4 w-20 rounded bg-muted/40" />
            <div className="mt-3 h-7 w-28 rounded bg-muted/30" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-2xl border border-border bg-card/50 p-6">
        <div className="h-5 w-32 rounded bg-muted/40" />
        <div className="mt-4 h-48 rounded-xl bg-muted/20" />
      </div>
    </div>
  );
}

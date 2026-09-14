import { Skeleton } from '@/components/ui/skeleton'

export default function GradeLoading() {
  return (
    <div className="min-h-screen bg-background md:pt-0 pt-14">
      {/* Sticky header bar */}
      <div className="sticky top-0 z-10 bg-card border-b px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Skeleton className="w-9 h-9 rounded-md flex-shrink-0" />
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        </div>
      </div>

      <div className="px-3 md:px-6 py-4 space-y-5">
        {/* Group meta */}
        <div className="flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>

        {/* Grade table card */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div style={{ padding: '0 0 0 0' }}>
            {/* Table header row */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid hsl(var(--border))', background: 'hsl(var(--muted))' }}>
              {[58, 140, 110, 110, 110, 110, 64].map((w, i) => (
                <div key={i} style={{ minWidth: w, padding: '12px', borderRight: '1px solid hsl(var(--border) / 0.4)' }}>
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-2 w-3/4" />
                </div>
              ))}
            </div>
            {/* Table rows */}
            {Array.from({ length: 5 }).map((_, ri) => (
              <div key={ri} style={{ display: 'flex', gap: 0, borderBottom: '1px solid hsl(var(--border) / 0.4)', background: ri % 2 === 0 ? 'hsl(var(--card))' : 'hsl(var(--muted) / 0.35)' }}>
                {[58, 140, 110, 110, 110, 110, 64].map((w, ci) => (
                  <div key={ci} style={{ minWidth: w, padding: '10px 12px', borderRight: '1px solid hsl(var(--border) / 0.25)' }}>
                    {ci >= 2 && ci <= 5 ? (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <Skeleton className="h-7 w-7 rounded-full" />
                        <Skeleton className="h-7 w-7 rounded-full" />
                        <Skeleton className="h-7 w-8 rounded-full" />
                      </div>
                    ) : (
                      <Skeleton className="h-4 w-full" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Feedback card */}
        <div className="rounded-xl border bg-card p-5">
          <Skeleton className="h-5 w-28 mb-4" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}

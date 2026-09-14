import { Skeleton } from '@/components/ui/skeleton'

export default function UsersLoading() {
  return (
    <div style={{ padding: '0 0 48px' }}>
      <div className="dashboard-topbar" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <Skeleton className="h-3 w-12 mb-2" />
          <Skeleton className="h-7 w-24 mb-2" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>

      <div style={{ margin: '0 24px', overflowX: 'auto' }}>
        <div style={{ borderRadius: 12, border: '1px solid hsl(var(--border))', overflow: 'hidden' }}>
          {/* header */}
          <div style={{ display: 'flex', gap: 0, background: 'hsl(var(--muted))', borderBottom: '2px solid hsl(var(--border))', padding: '10px 14px' }}>
            {[100, 180, 80, 100, 120, 100].map((w, i) => (
              <Skeleton key={i} className="h-3 mr-8" style={{ width: w }} />
            ))}
          </div>
          {/* rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 14px', borderBottom: '1px solid hsl(var(--border) / 0.35)', background: i % 2 === 0 ? 'hsl(var(--card))' : 'hsl(var(--muted) / 0.3)' }}>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48 ml-4" />
              <Skeleton className="h-6 w-16 rounded-full ml-4" />
              <Skeleton className="h-3 w-24 ml-4" />
              <Skeleton className="h-3 w-24 ml-4" />
              <div className="flex gap-2 ml-4">
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-8 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

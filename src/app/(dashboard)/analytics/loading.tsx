import { Skeleton } from '@/components/ui/skeleton'

export default function AnalyticsLoading() {
  return (
    <div style={{ padding: '20px 20px 40px', maxWidth: 820 }}>
      <div style={{ marginBottom: 24 }}>
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-8 w-56 mb-2" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div style={{ display: 'grid', gap: 16 }}>
        {[120, 180, 160, 200, 220].map((h, i) => (
          <Skeleton key={i} style={{ height: h, borderRadius: 'calc(var(--radius) * 1.6)' }} />
        ))}
      </div>
    </div>
  )
}

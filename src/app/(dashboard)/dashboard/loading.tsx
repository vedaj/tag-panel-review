import { Skeleton } from '@/components/ui/skeleton'

function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <Skeleton className="w-9 h-9 rounded-xl mb-3" />
      <Skeleton className="h-7 w-12 mb-1" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

function GroupCardSkeleton() {
  return (
    <div className="group-card" style={{ pointerEvents: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="h-3 w-40 mt-2" />
      <Skeleton className="h-3 w-24 mt-2" />
      <Skeleton className="h-1.5 w-full mt-3 rounded-full" />
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <>
      <div className="dashboard-topbar">
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-7 w-52 mb-2" />
        <Skeleton className="h-3 w-36" />
      </div>

      <div className="dashboard-section">
        <Skeleton className="h-3 w-16 mb-3" />
        <div className="stat-grid">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      </div>

      <div className="dashboard-section">
        <Skeleton className="h-3 w-14 mb-2" />
        <Skeleton className="h-6 w-36 mb-4" />
        <div className="group-grid">
          {Array.from({ length: 6 }).map((_, i) => <GroupCardSkeleton key={i} />)}
        </div>
      </div>
    </>
  )
}

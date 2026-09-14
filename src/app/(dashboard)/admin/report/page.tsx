'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { generateReport, downloadBlob } from '@/lib/excel'
import type { Group, Student, Profile, Criteria, Grade } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileDown, Loader2, RefreshCw, BarChart3, Users, CheckCircle2 } from 'lucide-react'

interface Stats {
  groups: Group[]
  students: Student[]
  faculty: Profile[]
  gradedCount: number
  totalGrades: number
}

export default function ReportPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function loadStats() {
    setLoading(true)
    const [{ data: groups }, { data: students }, { data: faculty }, { data: grades }] = await Promise.all([
      supabase.from('groups').select('*').order('name'),
      supabase.from('students').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('grades').select('student_id, faculty_id').limit(10000),
    ])

    const gradedStudentIds = new Set(grades?.map((g: { student_id: string }) => g.student_id) ?? [])
    setStats({
      groups: groups ?? [],
      students: students ?? [],
      faculty: faculty ?? [],
      gradedCount: gradedStudentIds.size,
      totalGrades: grades?.length ?? 0,
    })
    setLoading(false)
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const [{ data: groups }, { data: students }, { data: faculty }, { data: criteria }, { data: grades }] = await Promise.all([
        supabase.from('groups').select('*').order('name'),
        supabase.from('students').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('criteria').select('*, sub_criteria(*)').order('order_index'),
        supabase.from('grades').select('*').limit(100000),
      ])

      const sortedCriteria = (criteria ?? []).map((c) => ({
        ...c,
        sub_criteria: (c.sub_criteria ?? []).sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index),
      }))

      const blob = generateReport({
        groups: groups ?? [],
        students: students ?? [],
        faculty: faculty ?? [],
        criteria: sortedCriteria,
        grades: grades ?? [],
      })

      const date = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `TAG_Panel_Review_Report_${date}.xlsx`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="p-6 md:p-8 pt-20 md:pt-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Grade Report</h1>
        <p className="text-muted-foreground">Download the final grade report as an Excel file.</p>
      </div>

      <div className="space-y-6">
        {/* Stats */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 size={18} />
                Current Status
              </CardTitle>
              <Button variant="outline" size="sm" onClick={loadStats} disabled={loading} className="gap-1.5">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {stats ? 'Refresh' : 'Load Stats'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!stats && !loading && (
              <p className="text-sm text-muted-foreground">Click &quot;Load Stats&quot; to see current progress.</p>
            )}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Groups" value={stats.groups.length} icon={<Users size={18} />} />
                <StatCard label="Students" value={stats.students.length} icon={<Users size={18} />} />
                <StatCard label="Faculty" value={stats.faculty.length} icon={<Users size={18} />} />
                <StatCard label="Students Graded" value={stats.gradedCount} icon={<CheckCircle2 size={18} />} highlight />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Download */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileDown size={18} />
              Download Report
            </CardTitle>
            <CardDescription>
              The Excel file contains two sheets:
              <br />• <strong>Summary</strong> — mean scores per student across all criteria
              <br />• <strong>Raw Grades</strong> — individual marks given by each faculty member
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" onClick={handleDownload} disabled={downloading} className="gap-2">
              {downloading ? (
                <><Loader2 className="animate-spin" size={16} />Generating…</>
              ) : (
                <><FileDown size={16} />Download Excel Report</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, highlight }: { label: string; value: number; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-4 ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted'}`}>
      <div className={`mb-2 ${highlight ? 'text-primary' : 'text-muted-foreground'}`}>{icon}</div>
      <p className={`text-2xl font-bold ${highlight ? 'text-primary' : ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

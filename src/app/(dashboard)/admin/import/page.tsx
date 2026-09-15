'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { parseStudentExcel, parseFacultyExcel, type StudentRow, type FacultyRow } from '@/lib/excel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Upload, Users, GraduationCap, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet, Info } from 'lucide-react'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface ImportResult {
  groupsCreated: number
  studentsCreated: number
  facultyCreated: number
  errors: string[]
}

export default function ImportPage() {
  const supabase = createClient()
  const studentFileRef = useRef<HTMLInputElement>(null)
  const facultyFileRef = useRef<HTMLInputElement>(null)

  const [studentFile, setStudentFile] = useState<File | null>(null)
  const [facultyFile, setFacultyFile] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [preview, setPreview] = useState<StudentRow[]>([])
  const [facultyPreview, setFacultyPreview] = useState<FacultyRow[]>([])

  async function handleStudentFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setStudentFile(file)
    const rows = await parseStudentExcel(file)
    setPreview(rows.slice(0, 5))
  }

  async function handleFacultyFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFacultyFile(file)
    const rows = await parseFacultyExcel(file)
    setFacultyPreview(rows.slice(0, 5))
  }

  async function handleImport() {
    setStatus('loading')
    const errors: string[] = []
    let groupsCreated = 0
    let studentsCreated = 0
    let facultyCreated = 0

    try {
      // ── Import students ─────────────────────────────────────────────────
      if (studentFile) {
        const rows = await parseStudentExcel(studentFile)
        const groupMap = new Map<string, string>() // group_name -> id

        // Get or create groups
        const uniqueGroups = [...new Set(rows.map((r) => r.group_name?.trim()).filter(Boolean))]

        for (const groupName of uniqueGroups) {
          // Find matching rows for this group
          const groupRows = rows.filter((r) => r.group_name?.trim() === groupName)
          const first = groupRows[0]

          const { data: existing } = await supabase
            .from('groups')
            .select('id')
            .eq('name', groupName)
            .single()

          if (existing) {
            groupMap.set(groupName, existing.id)
            // Update metadata (title, guides) without touching grades or students
            await supabase.from('groups').update({
              project_title: first.project_title?.trim() ?? '',
              guide1: first.guide1?.trim() ?? '',
              guide2: first.guide2?.trim() || null,
            }).eq('id', existing.id)
          } else {
            const { data: newGroup, error } = await supabase
              .from('groups')
              .insert({
                name: groupName,
                project_title: first.project_title?.trim() ?? '',
                guide1: first.guide1?.trim() ?? '',
                guide2: first.guide2?.trim() || null,
              })
              .select('id')
              .single()

            if (error) {
              errors.push(`Group "${groupName}": ${error.message}`)
            } else if (newGroup) {
              groupMap.set(groupName, newGroup.id)
              groupsCreated++
            }
          }
        }

        // Insert students
        for (const row of rows) {
          const groupId = groupMap.get(row.group_name?.trim())
          if (!groupId) continue

          const { error } = await supabase
            .from('students')
            .upsert(
              { name: row.student_name?.trim(), roll_number: row.roll_number?.trim(), group_id: groupId },
              { onConflict: 'roll_number' }
            )

          if (error) {
            errors.push(`Student "${row.student_name}": ${error.message}`)
          } else {
            studentsCreated++
          }
        }
      }

      // ── Import faculty ──────────────────────────────────────────────────
      if (facultyFile) {
        const rows = await parseFacultyExcel(facultyFile)

        for (const row of rows) {
          if (!row.email?.trim()) continue

          // Create Supabase Auth user via admin invite (signup with random password)
          // We'll use signUp with metadata so the trigger creates the profile
          const tempPassword = Math.random().toString(36).slice(2) + 'Aa1!'

          const { data: authData, error: authErr } = await supabase.auth.signUp({
            email: row.email.trim().toLowerCase(),
            password: tempPassword,
            options: {
              data: {
                name: row.name?.trim() ?? row.email.split('@')[0],
                role: row.role?.trim() || 'faculty',
              },
            },
          })

          if (authErr && !authErr.message.includes('already registered')) {
            errors.push(`Faculty "${row.email}": ${authErr.message}`)
            continue
          }

          // Upsert profile directly too
          const { error: profileErr } = await supabase
            .from('profiles')
            .upsert(
              {
                id: authData?.user?.id,
                name: row.name?.trim() ?? row.email.split('@')[0],
                email: row.email.trim().toLowerCase(),
                role: (row.role?.trim() as 'admin' | 'faculty') || 'faculty',
              },
              { onConflict: 'email' }
            )

          if (!profileErr && authData?.user) facultyCreated++
        }
      }

      setResult({ groupsCreated, studentsCreated, facultyCreated, errors })
      setStatus('success')
    } catch (err) {
      errors.push(String(err))
      setResult({ groupsCreated, studentsCreated, facultyCreated, errors })
      setStatus('error')
    }
  }

  return (
    <div className="p-6 md:p-8 pt-20 md:pt-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Import Data</h1>
        <p className="text-muted-foreground">Upload your spreadsheets to add students, groups, and faculty accounts.</p>
      </div>

      {/* Format guide */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Info size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm space-y-2">
              <p className="font-semibold text-blue-900">Your spreadsheet needs these columns:</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="font-medium text-blue-800">Students file:</p>
                  <code className="text-xs bg-white rounded px-1 py-0.5 text-blue-900 block mt-1">
                    group_name | project_title | guide1 | guide2 | student_name | roll_number
                  </code>
                </div>
                <div>
                  <p className="font-medium text-blue-800">Faculty file:</p>
                  <code className="text-xs bg-white rounded px-1 py-0.5 text-blue-900 block mt-1">
                    name | email | role (admin/faculty)
                  </code>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Student import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap size={18} />
              Students &amp; Groups
            </CardTitle>
            <CardDescription>One student per row — rows sharing a group_name form one group.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input ref={studentFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleStudentFileChange} />
            <Button variant="outline" className="w-full gap-2" onClick={() => studentFileRef.current?.click()}>
              <FileSpreadsheet size={16} />
              {studentFile ? studentFile.name : 'Choose file…'}
            </Button>

            {preview.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Preview (first 5 rows):</p>
                {preview.map((row, i) => (
                  <div key={i} className="bg-muted rounded px-2 py-1">
                    <span className="font-medium">{row.group_name}</span> — {row.student_name} ({row.roll_number})
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Faculty import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users size={18} />
              Faculty
            </CardTitle>
            <CardDescription>Each person gets an account. They can set their own password via email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input ref={facultyFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFacultyFileChange} />
            <Button variant="outline" className="w-full gap-2" onClick={() => facultyFileRef.current?.click()}>
              <FileSpreadsheet size={16} />
              {facultyFile ? facultyFile.name : 'Choose file…'}
            </Button>

            {facultyPreview.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Preview (first 5 rows):</p>
                {facultyPreview.map((row, i) => (
                  <div key={i} className="bg-muted rounded px-2 py-1">
                    <span className="font-medium">{row.name}</span> — {row.email} <Badge variant="outline" className="ml-1 text-[10px]">{row.role || 'faculty'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Button
        size="lg"
        className="gap-2"
        disabled={(!studentFile && !facultyFile) || status === 'loading'}
        onClick={handleImport}
      >
        {status === 'loading' ? (
          <><Loader2 className="animate-spin" size={16} />Importing…</>
        ) : (
          <><Upload size={16} />Run Import</>
        )}
      </Button>

      {/* Results */}
      {result && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {status === 'success' && result.errors.length === 0 ? (
                <><CheckCircle2 size={18} className="text-green-600" />Import Complete</>
              ) : (
                <><AlertCircle size={18} className="text-yellow-600" />Import Finished with Issues</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{result.groupsCreated}</p>
                <p className="text-muted-foreground">Groups created</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{result.studentsCreated}</p>
                <p className="text-muted-foreground">Students imported</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{result.facultyCreated}</p>
                <p className="text-muted-foreground">Faculty created</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="font-medium text-destructive mb-2">Errors ({result.errors.length}):</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">{e}</p>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

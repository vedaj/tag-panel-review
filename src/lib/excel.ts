import * as XLSX from 'xlsx'
import type { Group, Student, Profile, Criteria, Grade, Feedback } from '@/types/database'

// ── Import helpers ──────────────────────────────────────────────────────────

export interface StudentRow {
  group_name: string
  project_title?: string
  guide1?: string
  guide2?: string
  student_name: string
  roll_number: string
}

export interface FacultyRow {
  name: string
  email: string
  role?: string
}

export function parseStudentExcel(file: File): Promise<StudentRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json<StudentRow>(ws, { defval: '' }))
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function parseFacultyExcel(file: File): Promise<FacultyRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json<FacultyRow>(ws, { defval: '' }))
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ── Export report ───────────────────────────────────────────────────────────

export interface ReportData {
  groups: Group[]
  students: Student[]
  faculty: Profile[]
  criteria: Criteria[]
  grades: Grade[]
  feedback: Feedback[]
}

export type ProjectType = 'research' | 'application' | 'software'
const ALL_TYPES: ProjectType[] = ['research', 'application', 'software']

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Mean score for a single criterion for a given student.
 * Only counts faculty who actually submitted a grade (no records = not counted).
 */
function critMean(studentId: string, crit: Criteria, grades: Grade[]): number {
  const hasSub = crit.sub_criteria && crit.sub_criteria.length > 0

  if (hasSub) {
    // Sum the per-sub-criterion means; each sub-mean ignores faculty who didn't grade it
    let total = 0
    for (const sub of crit.sub_criteria!) {
      const subGrades = grades.filter(
        (g) => g.student_id === studentId && g.criteria_id === crit.id && g.sub_criteria_id === sub.id
      )
      if (subGrades.length > 0) {
        total += subGrades.reduce((a, b) => a + b.marks, 0) / subGrades.length
      }
      // if no faculty graded this sub-criterion, contribute 0 to the sum
    }
    return parseFloat(total.toFixed(2))
  }

  const critGrades = grades.filter(
    (g) => g.student_id === studentId && g.criteria_id === crit.id && g.sub_criteria_id === null
  )
  if (critGrades.length === 0) return 0
  return parseFloat((critGrades.reduce((a, b) => a + b.marks, 0) / critGrades.length).toFixed(2))
}

function gatherComments(
  feedback: Feedback[],
  faculty: Profile[],
  groupId: string,
  studentId: string | null
): string {
  return feedback
    .filter((f) => f.group_id === groupId && f.student_id === studentId && f.content?.trim())
    .map((f) => {
      const fac = faculty.find((fc) => fc.id === f.faculty_id)
      return fac ? `[${fac.name}] ${f.content.trim()}` : f.content.trim()
    })
    .join('\n')
}

function buildSheet(data: ReportData, projectType: ProjectType): XLSX.WorkSheet {
  const { groups, students, faculty, criteria, grades, feedback } = data

  const typeCriteria = criteria
    .filter((c) => c.project_type === projectType)
    .sort((a, b) => a.order_index - b.order_index)

  const typeGroups = groups
    .filter((g) => g.project_type === projectType)
    .sort((a, b) => a.name.localeCompare(b.name))

  const headers: string[] = [
    'Group',
    'Project Title',
    'Project Type',
    'Guide 1',
    'Guide 2',
    'Roll Number',
    'Student Name',
    ...typeCriteria.map((c) => `${c.title} (/${c.max_marks})`),
    'Total',
    'Max Marks',
    '% Score',
    'Student Comments',
    'Group Comments',
  ]

  const aoa: (string | number)[][] = [headers]

  for (const group of typeGroups) {
    const groupStudents = students
      .filter((s) => s.group_id === group.id)
      .sort((a, b) => a.roll_number.localeCompare(b.roll_number))

    const groupComments = gatherComments(feedback, faculty, group.id, null)

    for (const student of groupStudents) {
      const scores = typeCriteria.map((c) => critMean(student.id, c, grades))
      const total = parseFloat(scores.reduce((a, b) => a + b, 0).toFixed(2))
      const maxTotal = typeCriteria.reduce((a, c) => a + c.max_marks, 0)
      const pct = maxTotal > 0 ? parseFloat(((total / maxTotal) * 100).toFixed(1)) : 0
      const studentComments = gatherComments(feedback, faculty, group.id, student.id)

      aoa.push([
        group.name,
        group.project_title,
        capitalize(projectType),
        group.guide1,
        group.guide2 ?? '',
        student.roll_number,
        student.name,
        ...scores,
        total,
        maxTotal,
        pct,
        studentComments,
        groupComments,
      ])
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }
  ws['!cols'] = [
    { wch: 14 },  // Group
    { wch: 32 },  // Project Title
    { wch: 14 },  // Project Type
    { wch: 22 },  // Guide 1
    { wch: 22 },  // Guide 2
    { wch: 14 },  // Roll Number
    { wch: 22 },  // Student Name
    ...typeCriteria.map(() => ({ wch: 18 })),
    { wch: 10 },  // Total
    { wch: 10 },  // Max Marks
    { wch: 10 },  // % Score
    { wch: 44 },  // Student Comments
    { wch: 44 },  // Group Comments
  ]

  return ws
}

/** One sheet per project type in a single workbook (the "all" download). */
export function generateAllReport(data: ReportData): Blob {
  const wb = XLSX.utils.book_new()
  for (const type of ALL_TYPES) {
    XLSX.utils.book_append_sheet(wb, buildSheet(data, type), capitalize(type))
  }
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/** Single-sheet workbook for one project type. */
export function generateProjectTypeReport(data: ReportData, projectType: ProjectType): Blob {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildSheet(data, projectType), capitalize(projectType))
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

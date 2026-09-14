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

  const generatedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

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

  // Metadata title block (3 rows) + blank row before data header
  const aoa: (string | number | null)[][] = [
    ['Amrita Vishwa Vidyapeetham — Data Science TAG Panel Review', ...Array(headers.length - 1).fill(null)],
    [`Project Type: ${capitalize(projectType)} Based`, ...Array(headers.length - 1).fill(null)],
    [`Generated: ${generatedDate}`, ...Array(headers.length - 1).fill(null)],
    Array(headers.length).fill(null),
    headers,
  ]

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

  // Freeze past the 4 metadata rows + 1 header row (row 5 is the column header)
  ws['!freeze'] = { xSplit: 0, ySplit: 5, topLeftCell: 'A6', activePane: 'bottomLeft', state: 'frozen' }
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

/**
 * Single combined sheet across all project types.
 * Criteria are labelled Criteria 1–4 (positional by order_index within each type).
 */
export function generateAllReport(data: ReportData): Blob {
  const { groups, students, faculty, criteria, grades, feedback } = data

  const NUM_CRITERIA = 4
  const generatedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

  const headers: string[] = [
    'Group',
    'Project Title',
    'Project Type',
    'Guide 1',
    'Guide 2',
    'Roll Number',
    'Student Name',
    'Criteria 1',
    'Criteria 2',
    'Criteria 3',
    'Criteria 4',
    'Total',
    'Max Marks',
    '% Score',
    'Student Comments',
    'Group Comments',
  ]

  const aoa: (string | number | null)[][] = [
    ['Amrita Vishwa Vidyapeetham — Data Science TAG Panel Review', ...Array(headers.length - 1).fill(null)],
    ['All Project Types — Combined Report', ...Array(headers.length - 1).fill(null)],
    [`Generated: ${generatedDate}`, ...Array(headers.length - 1).fill(null)],
    Array(headers.length).fill(null),
    headers,
  ]

  const allGroups = [...groups].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  )

  for (const group of allGroups) {
    const projectType = group.project_type as ProjectType | null
    if (!projectType) continue

    const typeCriteria = criteria
      .filter((c) => c.project_type === projectType)
      .sort((a, b) => a.order_index - b.order_index)
      .slice(0, NUM_CRITERIA)

    const maxTotal = typeCriteria.reduce((a, c) => a + c.max_marks, 0)
    const groupComments = gatherComments(feedback, faculty, group.id, null)

    const groupStudents = students
      .filter((s) => s.group_id === group.id)
      .sort((a, b) => a.roll_number.localeCompare(b.roll_number))

    for (const student of groupStudents) {
      const scores = typeCriteria.map((c) => critMean(student.id, c, grades))
      // Pad to 4 columns if fewer criteria defined
      while (scores.length < NUM_CRITERIA) scores.push(0)

      const total = parseFloat(scores.reduce((a, b) => a + b, 0).toFixed(2))
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
  ws['!freeze'] = { xSplit: 0, ySplit: 5, topLeftCell: 'A6', activePane: 'bottomLeft', state: 'frozen' }
  ws['!cols'] = [
    { wch: 14 },  // Group
    { wch: 32 },  // Project Title
    { wch: 16 },  // Project Type
    { wch: 22 },  // Guide 1
    { wch: 22 },  // Guide 2
    { wch: 14 },  // Roll Number
    { wch: 22 },  // Student Name
    { wch: 14 },  // Criteria 1
    { wch: 14 },  // Criteria 2
    { wch: 14 },  // Criteria 3
    { wch: 14 },  // Criteria 4
    { wch: 10 },  // Total
    { wch: 10 },  // Max Marks
    { wch: 10 },  // % Score
    { wch: 44 },  // Student Comments
    { wch: 44 },  // Group Comments
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'All Groups')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/**
 * Returns the score a single faculty gave for one criterion (or null if they didn't grade it).
 * For sub-criteria: sum of their per-sub marks.
 * For top-level: their single mark.
 */
function facultyCritScore(
  studentId: string,
  crit: Criteria,
  facultyId: string,
  grades: Grade[]
): number | null {
  const hasSub = crit.sub_criteria && crit.sub_criteria.length > 0
  if (hasSub) {
    const subGrades = grades.filter(
      (g) => g.student_id === studentId && g.criteria_id === crit.id && g.faculty_id === facultyId && g.sub_criteria_id !== null
    )
    if (subGrades.length === 0) return null
    return parseFloat(subGrades.reduce((a, b) => a + b.marks, 0).toFixed(2))
  }
  const g = grades.find(
    (g) => g.student_id === studentId && g.criteria_id === crit.id && g.faculty_id === facultyId && g.sub_criteria_id === null
  )
  return g ? g.marks : null
}

/** Audit workbook: one row per (student, faculty), showing raw marks awarded by each faculty member. */
export function generateAuditReport(data: ReportData): Blob {
  const { groups, students, faculty, criteria, grades, feedback } = data

  const NUM_CRITERIA = 4
  const generatedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

  const headers: string[] = [
    'Group',
    'Project Title',
    'Project Type',
    'Roll Number',
    'Student Name',
    'Faculty Name',
    'Faculty Email',
    'Criteria 1',
    'Criteria 2',
    'Criteria 3',
    'Criteria 4',
    'Total Awarded',
    'Max Marks',
    'Comments',
  ]

  const aoa: (string | number | null)[][] = [
    ['Amrita Vishwa Vidyapeetham — Data Science TAG Panel Review — AUDIT', ...Array(headers.length - 1).fill(null)],
    ['Per-Faculty Marks Awarded (Confidential)', ...Array(headers.length - 1).fill(null)],
    [`Generated: ${generatedDate}`, ...Array(headers.length - 1).fill(null)],
    Array(headers.length).fill(null),
    headers,
  ]

  const allGroups = [...groups].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  )

  for (const group of allGroups) {
    const projectType = group.project_type as ProjectType | null
    if (!projectType) continue

    const typeCriteria = criteria
      .filter((c) => c.project_type === projectType)
      .sort((a, b) => a.order_index - b.order_index)
      .slice(0, NUM_CRITERIA)

    const maxTotal = typeCriteria.reduce((a, c) => a + c.max_marks, 0)

    const groupStudents = students
      .filter((s) => s.group_id === group.id)
      .sort((a, b) => a.roll_number.localeCompare(b.roll_number))

    for (const student of groupStudents) {
      // Find every faculty who graded this student
      const gradingFacultyIds = [...new Set(
        grades
          .filter((g) => g.student_id === student.id)
          .map((g) => g.faculty_id)
      )]

      const sortedFaculty = gradingFacultyIds
        .map((id) => faculty.find((f) => f.id === id))
        .filter(Boolean) as Profile[]
      sortedFaculty.sort((a, b) => a.name.localeCompare(b.name))

      for (const fac of sortedFaculty) {
        const scores = typeCriteria.map((c) => facultyCritScore(student.id, c, fac.id, grades))
        while (scores.length < NUM_CRITERIA) scores.push(null)

        const numericScores = scores.map((s) => s ?? 0)
        const total = parseFloat(numericScores.reduce((a, b) => a + b, 0).toFixed(2))

        const comment = feedback.find(
          (fb) => fb.faculty_id === fac.id && fb.group_id === group.id && fb.student_id === student.id
        )?.content ?? ''

        aoa.push([
          group.name,
          group.project_title,
          capitalize(projectType),
          student.roll_number,
          student.name,
          fac.name,
          fac.email,
          ...scores,
          total,
          maxTotal,
          comment,
        ])
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!freeze'] = { xSplit: 0, ySplit: 5, topLeftCell: 'A6', activePane: 'bottomLeft', state: 'frozen' }
  ws['!cols'] = [
    { wch: 14 },  // Group
    { wch: 30 },  // Project Title
    { wch: 14 },  // Project Type
    { wch: 14 },  // Roll Number
    { wch: 22 },  // Student Name
    { wch: 24 },  // Faculty Name
    { wch: 28 },  // Faculty Email
    { wch: 12 },  // Criteria 1
    { wch: 12 },  // Criteria 2
    { wch: 12 },  // Criteria 3
    { wch: 12 },  // Criteria 4
    { wch: 14 },  // Total Awarded
    { wch: 10 },  // Max Marks
    { wch: 44 },  // Comments
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Audit')
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

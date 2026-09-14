import * as XLSX from 'xlsx'
import type { Group, Student, Profile, Criteria, SubCriteria, Grade } from '@/types/database'

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
        const rows = XLSX.utils.sheet_to_json<StudentRow>(ws, { defval: '' })
        resolve(rows)
      } catch (err) {
        reject(err)
      }
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
        const rows = XLSX.utils.sheet_to_json<FacultyRow>(ws, { defval: '' })
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ── Export report ───────────────────────────────────────────────────────────

interface ReportData {
  groups: Group[]
  students: Student[]
  faculty: Profile[]
  criteria: Criteria[]
  grades: Grade[]
}

export function generateReport(data: ReportData): Blob {
  const { groups, students, faculty, criteria, grades } = data

  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Summary (mean scores per student) ──────────────────────────
  const summaryRows: Record<string, string | number>[] = []

  for (const group of groups) {
    const groupStudents = students.filter((s) => s.group_id === group.id)
    for (const student of groupStudents) {
      const row: Record<string, string | number> = {
        'Group': group.name,
        'Project Title': group.project_title,
        'Guide 1': group.guide1,
        'Guide 2': group.guide2 ?? '',
        'Roll Number': student.roll_number,
        'Student Name': student.name,
      }

      // Per-criterion mean
      let grandTotal = 0
      let maxTotal = 0

      for (const crit of criteria) {
        const critGrades = grades.filter(
          (g) => g.student_id === student.id && g.criteria_id === crit.id && g.sub_criteria_id === null
        )
        const hasSub = crit.sub_criteria && crit.sub_criteria.length > 0

        if (hasSub) {
          // Compute mean from sub-criteria
          let critSubTotal = 0
          for (const sub of crit.sub_criteria!) {
            const subGrades = grades.filter(
              (g) =>
                g.student_id === student.id &&
                g.criteria_id === crit.id &&
                g.sub_criteria_id === sub.id
            )
            const mean =
              subGrades.length > 0
                ? subGrades.reduce((a, b) => a + b.marks, 0) / subGrades.length
                : 0
            row[`${crit.title} > ${sub.title} (/${sub.max_marks})`] = parseFloat(mean.toFixed(2))
            critSubTotal += mean
          }
          const critMean = crit.sub_criteria!.length > 0 ? critSubTotal : 0
          row[`${crit.title} Total (/${crit.max_marks})`] = parseFloat(critMean.toFixed(2))
          grandTotal += critMean
        } else {
          const mean =
            critGrades.length > 0
              ? critGrades.reduce((a, b) => a + b.marks, 0) / critGrades.length
              : 0
          row[`${crit.title} (/${crit.max_marks})`] = parseFloat(mean.toFixed(2))
          grandTotal += mean
        }
        maxTotal += crit.max_marks
      }

      row['Total Marks'] = parseFloat(grandTotal.toFixed(2))
      row['Max Marks'] = maxTotal
      row['Percentage'] = maxTotal > 0 ? parseFloat(((grandTotal / maxTotal) * 100).toFixed(1)) : 0
      summaryRows.push(row)
    }
  }

  const summaryWS = XLSX.utils.json_to_sheet(summaryRows)
  XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary')

  // ── Sheet 2: Raw grades per faculty ─────────────────────────────────────
  const rawRows: Record<string, string | number>[] = []

  for (const fac of faculty) {
    for (const group of groups) {
      const groupStudents = students.filter((s) => s.group_id === group.id)
      for (const student of groupStudents) {
        const row: Record<string, string | number> = {
          'Faculty': fac.name,
          'Group': group.name,
          'Student': student.name,
          'Roll Number': student.roll_number,
        }
        for (const crit of criteria) {
          if (crit.sub_criteria && crit.sub_criteria.length > 0) {
            for (const sub of crit.sub_criteria) {
              const g = grades.find(
                (gr) =>
                  gr.faculty_id === fac.id &&
                  gr.student_id === student.id &&
                  gr.criteria_id === crit.id &&
                  gr.sub_criteria_id === sub.id
              )
              row[`${crit.title} > ${sub.title}`] = g ? g.marks : '-'
            }
          } else {
            const g = grades.find(
              (gr) =>
                gr.faculty_id === fac.id &&
                gr.student_id === student.id &&
                gr.criteria_id === crit.id &&
                gr.sub_criteria_id === null
            )
            row[`${crit.title}`] = g ? g.marks : '-'
          }
        }
        rawRows.push(row)
      }
    }
  }

  const rawWS = XLSX.utils.json_to_sheet(rawRows)
  XLSX.utils.book_append_sheet(wb, rawWS, 'Raw Grades')

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

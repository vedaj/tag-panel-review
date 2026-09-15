import * as XLSX from 'xlsx-js-style'
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

// ── Style constants ─────────────────────────────────────────────────────────

const C = {
  // Brand
  ind900: '1E1B4B', ind800: '312E81', ind700: '4338CA', ind600: '4F46E5',
  ind100: 'E0E7FF', ind50:  'EEF2FF',
  vio600: '7C3AED', vio200: 'DDD6FE', vio100: 'EDE9FE', vio50:  'F5F3FF',
  // Grays
  white:  'FFFFFF', gray50: 'F9FAFB', gray100: 'F3F4F6', gray200: 'E5E7EB',
  gray300: 'D1D5DB', gray400: '9CA3AF', gray500: '6B7280',
  gray700: '374151', gray800: '1F2937',
  // Score: high / mid / low
  grnBg: 'D1FAE5', grnTx: '065F46',
  ylwBg: 'FEF3C7', ylwTx: '78350F',
  redBg: 'FEE2E2', redTx: '991B1B',
  // Total / special
  totBg: 'CCFBF1', totTx: '134E4A',
  // Project type chips
  resBg: 'DBEAFE', resTx: '1D4ED8',
  appBg: 'D1FAE5', appTx: '065F46',
  sftBg: 'EDE9FE', sftTx: '5B21B6',
}

type CellStyle = Record<string, unknown>

function solidFill(rgb: string) {
  return { patternType: 'solid', fgColor: { rgb }, bgColor: { indexed: 64 } }
}

function borderAll(rgb = C.gray200): CellStyle {
  const s = { style: 'thin', color: { rgb } }
  return { top: s, bottom: s, left: s, right: s }
}
function borderBottom(rgb = C.gray200): CellStyle {
  return { bottom: { style: 'thin', color: { rgb } } }
}

function scoreColors(score: number, max: number): [string, string] {
  if (score === 0 || max === 0) return [C.gray50, C.gray400]
  const p = (score / max) * 100
  if (p >= 80) return [C.grnBg, C.grnTx]
  if (p >= 60) return [C.ylwBg, C.ylwTx]
  return [C.redBg, C.redTx]
}

function pctColors(pct: number): [string, string] {
  if (pct >= 80) return [C.grnBg, C.grnTx]
  if (pct >= 60) return [C.ylwBg, C.ylwTx]
  return [C.redBg, C.redTx]
}

function typeColors(pt: string): [string, string] {
  if (pt.toLowerCase().startsWith('res')) return [C.resBg, C.resTx]
  if (pt.toLowerCase().startsWith('app')) return [C.appBg, C.appTx]
  return [C.sftBg, C.sftTx]
}

// Base styles for common patterns
const S = {
  titleCell: {
    fill: solidFill(C.ind800),
    font: { bold: true, color: { rgb: C.white }, sz: 14, name: 'Calibri' },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
  },
  institutionCell: {
    fill: solidFill(C.ind900),
    font: { color: { rgb: C.ind100 }, sz: 10, name: 'Calibri' },
    alignment: { horizontal: 'left', vertical: 'center' },
  },
  subtitleCell: {
    fill: solidFill(C.vio100),
    font: { bold: true, italic: false, color: { rgb: C.ind800 }, sz: 11, name: 'Calibri' },
    alignment: { horizontal: 'left', vertical: 'center' },
  },
  dateCell: {
    fill: solidFill(C.gray50),
    font: { italic: true, color: { rgb: C.gray500 }, sz: 10, name: 'Calibri' },
    alignment: { horizontal: 'left', vertical: 'center' },
  },
  blankCell: {
    fill: solidFill(C.gray100),
    font: { sz: 6 },
  },
  headerCell: {
    fill: solidFill(C.ind700),
    font: { bold: true, color: { rgb: C.white }, sz: 10, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderAll(C.ind600),
  },
  textLeft: (rowBg: string) => ({
    fill: solidFill(rowBg),
    font: { color: { rgb: C.gray700 }, sz: 10 },
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    border: borderAll(C.gray200),
  }),
  textCenter: (rowBg: string) => ({
    fill: solidFill(rowBg),
    font: { color: { rgb: C.gray700 }, sz: 10 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll(C.gray200),
  }),
}

// Encode cell address (row + col, 0-indexed)
function addr(r: number, c: number): string {
  return XLSX.utils.encode_cell({ r, c })
}

function cellAt(ws: Record<string, unknown>, r: number, c: number): Record<string, unknown> {
  const a = addr(r, c)
  if (!ws[a]) ws[a] = { v: null, t: 'z' }
  return ws[a] as Record<string, unknown>
}

// ── Apply styles to a sheet ─────────────────────────────────────────────────

interface StyleConfig {
  numCols: number
  // Column classification (all 0-indexed)
  leftTextCols: Set<number>       // left-aligned text (group, name, comments…)
  centerTextCols: Set<number>     // center-aligned text (roll no, type…)
  scoreColMaxes: Map<number, number> // col → max marks for score cols
  totalCol: number
  totalMax: number
  maxMarksCol: number
  pctCol: number
  commentCols: Set<number>        // wrap-text comment cols
  typeCol: number                 // project type column (colored by type)
  numDataRows: number
}

function applyStyles(ws: Record<string, unknown>, cfg: StyleConfig) {
  const { numCols, numDataRows } = cfg
  const DATA_START = 8  // first data row (0-indexed)

  // ── Merged header rows ─────────────────────────────────────────────────
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: numCols - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: numCols - 1 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: numCols - 1 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: numCols - 1 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: numCols - 1 } },
  ]

  // ── Row heights ────────────────────────────────────────────────────────
  ws['!rows'] = [
    { hpt: 30 },  // title
    { hpt: 16 },  // institution line 1
    { hpt: 16 },  // institution line 2
    { hpt: 16 },  // institution line 3
    { hpt: 20 },  // subtitle
    { hpt: 15 },  // date
    { hpt: 5 },   // blank
    { hpt: 36 },  // column headers
    ...Array(numDataRows).fill({ hpt: 20 }),
  ]

  for (let R = 0; R < DATA_START + numDataRows; R++) {
    const isTitle = R === 0
    const isInstitution = R >= 1 && R <= 3
    const isSubtitle = R === 4
    const isDate = R === 5
    const isBlank = R === 6
    const isHeader = R === 7
    const isData = R >= DATA_START

    // Even/odd striping for data rows
    const rowBg = isData
      ? (R - DATA_START) % 2 === 0 ? C.white : C.vio50
      : C.white

    for (let C_ = 0; C_ < numCols; C_++) {
      const cell = cellAt(ws, R, C_)
      const val = cell.v as number | string | null

      if (isTitle)       { cell.s = S.titleCell;       continue }
      if (isInstitution) { cell.s = S.institutionCell; continue }
      if (isSubtitle)    { cell.s = S.subtitleCell;    continue }
      if (isDate)        { cell.s = S.dateCell;        continue }
      if (isBlank)       { cell.s = S.blankCell;       continue }

      if (isHeader) {
        cell.s = S.headerCell
        continue
      }

      // ── Data rows ──────────────────────────────────────────────────────

      // Project type column — colored chip
      if (C_ === cfg.typeCol) {
        const [bg, tx] = typeColors(String(val ?? ''))
        cell.s = {
          fill: solidFill(bg),
          font: { bold: true, color: { rgb: tx }, sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: borderAll(C.gray200),
        }
        continue
      }

      // Score columns
      if (cfg.scoreColMaxes.has(C_)) {
        const max = cfg.scoreColMaxes.get(C_)!
        const [bgc, txc] = scoreColors(Number(val ?? 0), max)
        cell.s = {
          fill: solidFill(bgc),
          font: { bold: false, color: { rgb: txc }, sz: 11 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: borderAll(C.gray200),
        }
        continue
      }

      // Total column
      if (C_ === cfg.totalCol) {
        const [bgc, txc] = scoreColors(Number(val ?? 0), cfg.totalMax)
        cell.s = {
          fill: solidFill(bgc),
          font: { bold: true, color: { rgb: txc }, sz: 11 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: borderAll(C.gray200),
        }
        continue
      }

      // Max Marks column
      if (C_ === cfg.maxMarksCol) {
        cell.s = {
          fill: solidFill(rowBg),
          font: { color: { rgb: C.gray500 }, sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: borderAll(C.gray200),
        }
        continue
      }

      // % Score column
      if (C_ === cfg.pctCol) {
        const [bgc, txc] = pctColors(Number(val ?? 0))
        cell.s = {
          fill: solidFill(bgc),
          font: { bold: true, color: { rgb: txc }, sz: 11 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: borderAll(C.gray200),
        }
        continue
      }

      // Comment columns — wrap text
      if (cfg.commentCols.has(C_)) {
        cell.s = {
          fill: solidFill(rowBg),
          font: { color: { rgb: C.gray700 }, sz: 9, italic: true },
          alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
          border: borderBottom(C.gray200),
        }
        continue
      }

      // Left-aligned text
      if (cfg.leftTextCols.has(C_)) {
        cell.s = S.textLeft(rowBg)
        continue
      }

      // Center-aligned text (default for remaining)
      cell.s = S.textCenter(rowBg)
    }
  }
}

// ── Report data ─────────────────────────────────────────────────────────────

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

function critMean(studentId: string, crit: Criteria, grades: Grade[]): number {
  const hasSub = crit.sub_criteria && crit.sub_criteria.length > 0
  if (hasSub) {
    let total = 0
    for (const sub of crit.sub_criteria!) {
      const subGrades = grades.filter(
        (g) => g.student_id === studentId && g.criteria_id === crit.id && g.sub_criteria_id === sub.id
      )
      if (subGrades.length > 0)
        total += subGrades.reduce((a, b) => a + b.marks, 0) / subGrades.length
    }
    return parseFloat(total.toFixed(2))
  }
  const critGrades = grades.filter(
    (g) => g.student_id === studentId && g.criteria_id === crit.id && g.sub_criteria_id === null
  )
  if (critGrades.length === 0) return 0
  return parseFloat((critGrades.reduce((a, b) => a + b.marks, 0) / critGrades.length).toFixed(2))
}

function gatherComments(feedback: Feedback[], faculty: Profile[], groupId: string, studentId: string | null): string {
  return feedback
    .filter((f) => f.group_id === groupId && f.student_id === studentId && f.content?.trim())
    .map((f) => {
      const fac = faculty.find((fc) => fc.id === f.faculty_id)
      return fac ? `[${fac.name}] ${f.content.trim()}` : f.content.trim()
    })
    .join('\n')
}

// ── Per-type sheet ──────────────────────────────────────────────────────────

function buildSheet(data: ReportData, projectType: ProjectType): Record<string, unknown> {
  const { groups, students, faculty, criteria, grades, feedback } = data

  const typeCriteria = criteria
    .filter((c) => c.project_type === projectType)
    .sort((a, b) => a.order_index - b.order_index)

  const typeGroups = groups
    .filter((g) => g.project_type === projectType)
    .sort((a, b) => a.name.localeCompare(b.name))

  const generatedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

  const headers: string[] = [
    'Group', 'Project Title', 'Project Type', 'Guide 1', 'Guide 2',
    'Roll Number', 'Student Name',
    ...typeCriteria.map((c) => `${c.title}\n(/${c.max_marks})`),
    'Total', 'Max Marks', '% Score',
    'Student Comments', 'Group Comments',
  ]

  const aoa: (string | number | null)[][] = [
    ['Panel Review - Data Science TAG'],
    ['Department of Computer Science & Engineering'],
    ['School of Computing'],
    ['Amrita Vishwa Vidyapeetham, Coimbatore'],
    [`${capitalize(projectType)} Based Projects — Grade Report`],
    [`Generated: ${generatedDate}`],
    [null],
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
        group.name, group.project_title, capitalize(projectType),
        group.guide1, group.guide2 ?? '',
        student.roll_number, student.name,
        ...scores, total, maxTotal, pct,
        studentComments, groupComments,
      ])
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa) as Record<string, unknown>

  const numCritCols = typeCriteria.length
  // Col indices (0-based): Group=0, Title=1, Type=2, G1=3, G2=4, Roll=5, Name=6, scores=7..7+n-1
  const firstScore = 7
  const lastScore = 7 + numCritCols - 1
  const totalCol = lastScore + 1
  const maxCol = totalCol + 1
  const pctCol = maxCol + 1
  const commentStart = pctCol + 1
  const numCols = headers.length
  const totalMax = typeCriteria.reduce((a, c) => a + c.max_marks, 0)

  const scoreColMaxes = new Map<number, number>()
  typeCriteria.forEach((c, i) => scoreColMaxes.set(firstScore + i, c.max_marks))

  applyStyles(ws, {
    numCols,
    leftTextCols: new Set([0, 1, 3, 4, 6]),
    centerTextCols: new Set([2, 5]),
    scoreColMaxes,
    totalCol,
    totalMax,
    maxMarksCol: maxCol,
    pctCol,
    commentCols: new Set([commentStart, commentStart + 1]),
    typeCol: 2,
    numDataRows: aoa.length - 8,
  })

  ws['!freeze'] = { xSplit: 0, ySplit: 8, topLeftCell: 'A9', activePane: 'bottomLeft', state: 'frozen' }
  ws['!cols'] = [
    { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 22 }, { wch: 18 },
    { wch: 14 }, { wch: 22 },
    ...typeCriteria.map(() => ({ wch: 18 })),
    { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 44 }, { wch: 44 },
  ]

  return ws
}

// ── Combined report ─────────────────────────────────────────────────────────

export function generateAllReport(data: ReportData): Blob {
  const { groups, students, faculty, criteria, grades, feedback } = data
  const NUM_CRITERIA = 4
  const generatedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

  const headers: string[] = [
    'Group', 'Project Title', 'Project Type', 'Guide 1', 'Guide 2',
    'Roll Number', 'Student Name',
    'Criteria 1', 'Criteria 2', 'Criteria 3', 'Criteria 4',
    'Total', 'Max Marks', '% Score',
    'Student Comments', 'Group Comments',
  ]

  const aoa: (string | number | null)[][] = [
    ['Panel Review - Data Science TAG'],
    ['Department of Computer Science & Engineering'],
    ['School of Computing'],
    ['Amrita Vishwa Vidyapeetham, Coimbatore'],
    ['All Project Types — Combined Grade Report'],
    [`Generated: ${generatedDate}`],
    [null],
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
      while (scores.length < NUM_CRITERIA) scores.push(0)
      const total = parseFloat(scores.reduce((a, b) => a + b, 0).toFixed(2))
      const pct = maxTotal > 0 ? parseFloat(((total / maxTotal) * 100).toFixed(1)) : 0
      const studentComments = gatherComments(feedback, faculty, group.id, student.id)
      aoa.push([
        group.name, group.project_title, capitalize(projectType),
        group.guide1, group.guide2 ?? '',
        student.roll_number, student.name,
        ...scores, total, maxTotal, pct,
        studentComments, groupComments,
      ])
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa) as Record<string, unknown>

  // For combined report we don't have per-criteria maxes so skip score col coloring;
  // only color Total, % and Project Type
  applyStyles(ws, {
    numCols: headers.length,
    leftTextCols: new Set([0, 1, 3, 4, 6]),
    centerTextCols: new Set([5]),
    scoreColMaxes: new Map(),       // no per-column max in combined report
    totalCol: 11,
    totalMax: 0,                    // 0 = skip total conditional (different per row)
    maxMarksCol: 12,
    pctCol: 13,
    commentCols: new Set([14, 15]),
    typeCol: 2,
    numDataRows: aoa.length - 8,
  })

  ws['!freeze'] = { xSplit: 0, ySplit: 8, topLeftCell: 'A9', activePane: 'bottomLeft', state: 'frozen' }
  ws['!cols'] = [
    { wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 22 }, { wch: 18 },
    { wch: 14 }, { wch: 22 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 44 }, { wch: 44 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'All Groups')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ── Audit report ────────────────────────────────────────────────────────────

function facultyCritScore(studentId: string, crit: Criteria, facultyId: string, grades: Grade[]): number | null {
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

export function generateAuditReport(data: ReportData): Blob {
  const { groups, students, faculty, criteria, grades, feedback } = data
  const NUM_CRITERIA = 4
  const generatedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

  const headers: string[] = [
    'Group', 'Project Title', 'Project Type',
    'Roll Number', 'Student Name',
    'Faculty Name', 'Faculty Email',
    'Criteria 1', 'Criteria 2', 'Criteria 3', 'Criteria 4',
    'Total Awarded', 'Max Marks', 'Comments',
  ]

  const aoa: (string | number | null)[][] = [
    ['Panel Review - Data Science TAG'],
    ['Department of Computer Science & Engineering'],
    ['School of Computing'],
    ['Amrita Vishwa Vidyapeetham, Coimbatore'],
    ['Per-Faculty Marks Awarded — Audit Report · Confidential'],
    [`Generated: ${generatedDate}`],
    [null],
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
      const gradingFacultyIds = [...new Set(
        grades.filter((g) => g.student_id === student.id).map((g) => g.faculty_id)
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
          group.name, group.project_title, capitalize(projectType),
          student.roll_number, student.name,
          fac.name, fac.email,
          ...scores, total, maxTotal, comment,
        ])
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa) as Record<string, unknown>

  applyStyles(ws, {
    numCols: headers.length,
    leftTextCols: new Set([0, 1, 4, 5, 6]),
    centerTextCols: new Set([3]),
    scoreColMaxes: new Map(),
    totalCol: 11,
    totalMax: 0,
    maxMarksCol: 12,
    pctCol: -1,           // no % col in audit
    commentCols: new Set([13]),
    typeCol: 2,
    numDataRows: aoa.length - 8,
  })

  ws['!freeze'] = { xSplit: 0, ySplit: 8, topLeftCell: 'A9', activePane: 'bottomLeft', state: 'frozen' }
  ws['!cols'] = [
    { wch: 14 }, { wch: 30 }, { wch: 14 },
    { wch: 14 }, { wch: 22 },
    { wch: 24 }, { wch: 28 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 14 }, { wch: 10 }, { wch: 44 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Audit')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ── Per-type workbook ────────────────────────────────────────────────────────

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

// Satisfy TS — ALL_TYPES referenced to avoid unused warning
void ALL_TYPES

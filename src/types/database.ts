export type Role = 'admin' | 'faculty'

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  created_at: string
}

export type ProjectType = 'research' | 'application' | 'software' | ''

export interface Group {
  id: string
  name: string
  project_title: string
  guide1: string
  guide2: string | null
  project_type: ProjectType
  created_at: string
  students?: Student[]
  panel_assignments?: PanelAssignment[]
}

export interface Student {
  id: string
  name: string
  roll_number: string
  group_id: string
  created_at: string
  group?: Group
}

export interface Criteria {
  id: string
  title: string
  description: string
  max_marks: number
  order_index: number
  project_type: 'research' | 'application' | 'software' | 'all'
  allowed_marks: string
  created_at: string
  sub_criteria?: SubCriteria[]
}

export interface SubCriteria {
  id: string
  criteria_id: string
  title: string
  description: string
  max_marks: number
  order_index: number
  allowed_marks: string
  created_at: string
}

export interface PanelAssignment {
  id: string
  faculty_id: string
  group_id: string
  created_at: string
  faculty?: Profile
  group?: Group
}

export interface Grade {
  id: string
  faculty_id: string
  student_id: string
  criteria_id: string
  sub_criteria_id: string | null
  marks: number
  created_at: string
  updated_at: string
}

export interface Feedback {
  id: string
  faculty_id: string
  group_id: string
  student_id: string | null
  content: string
  created_at: string
  updated_at: string
}

// UI helpers
export interface GradeMap {
  [key: string]: number // key: `${studentId}:${criteriaId}:${subCriteriaId|'null'}`
}

export interface FeedbackMap {
  [key: string]: string // key: `${groupId}:${studentId|'group'}`
}

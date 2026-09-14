import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function gradeKey(
  studentId: string,
  criteriaId: string,
  subCriteriaId: string | null
) {
  return `${studentId}:${criteriaId}:${subCriteriaId ?? 'null'}`
}

export function feedbackKey(groupId: string, studentId: string | null) {
  return `${groupId}:${studentId ?? 'group'}`
}

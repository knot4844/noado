import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  // tailwind-merge 없이 clsx만 사용
  return clsx(inputs)
}

/** 숫자를 한국 원화 형식으로 포맷 */
export function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원'
}

/** 날짜를 한국 형식으로 포맷 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/** 전화번호 포맷 (01012345678 → 010-1234-5678) */
export function formatPhone(phone: string | null): string {
  if (!phone) return '-'
  return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
}

/** 현재 연/월 반환 */
export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

/** YYYY-MM 형식 문자열 반환 */
export function toMonthString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

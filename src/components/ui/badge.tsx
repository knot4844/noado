'use client'

import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClass: Record<BadgeVariant, string> = {
  default: 'bg-[var(--color-primary)] text-white',
  success: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  danger:  'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
  info:    'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  muted:   'bg-[var(--color-muted-bg)] text-[var(--color-muted)]',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        variantClass[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

/** 호실 상태 배지 */
export function RoomStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    PAID:   { label: '납부완료', variant: 'success' },
    UNPAID: { label: '미납',    variant: 'danger'  },
    VACANT: { label: '공실',    variant: 'muted'   },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'muted' }
  return <Badge variant={variant}>{label}</Badge>
}

'use client'

import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: React.ReactNode
}

const variantClass: Record<ButtonVariant, string> = {
  primary:   'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-light)] active:bg-[var(--color-primary-dark)]',
  secondary: 'bg-[var(--color-accent)] text-[var(--color-primary)] hover:bg-[var(--color-accent-dark)]',
  outline:   'border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]',
  ghost:     'text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]',
  danger:    'bg-[var(--color-danger-bg)] text-[var(--color-danger)] hover:bg-red-100',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1',
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}

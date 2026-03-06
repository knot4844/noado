import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[var(--color-foreground)]">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'w-full px-3 py-2 text-sm rounded-lg border transition-colors',
          'bg-[var(--color-surface)] text-[var(--color-foreground)]',
          'border-[var(--color-border)] placeholder:text-[var(--color-muted)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent',
          error && 'border-[var(--color-danger)] focus:ring-[var(--color-danger)]',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}

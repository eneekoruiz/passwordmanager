import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

const inputClassName =
  'w-full rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary shadow-subtle outline-none transition-colors focus:border-border focus:ring-1 focus:ring-border/50'

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function FormField({ label, className, ...props }: FormFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">
        {label}
      </span>
      <input className={`${inputClassName} ${className ?? ''}`} {...props} />
    </label>
  )
}

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
}

export function FormTextarea({ label, className, ...props }: FormTextareaProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">
        {label}
      </span>
      <textarea
        className={`${inputClassName} min-h-[120px] resize-y ${className ?? ''}`}
        {...props}
      />
    </label>
  )
}

export { inputClassName }

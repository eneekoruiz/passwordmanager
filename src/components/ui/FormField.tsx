import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

const inputClassName =
  'w-full rounded-xl border border-black/[0.06] bg-white/80 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary shadow-[0_8px_24px_rgba(0,0,0,0.025)] outline-none transition-all duration-150 focus:border-black/15 focus:bg-white focus:ring-2 focus:ring-black/[0.035]'

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

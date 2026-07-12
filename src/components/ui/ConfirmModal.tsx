import { useEffect } from 'react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  type?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  type = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const colorConfig = {
    danger: {
      bg: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
      btn: 'bg-red-600 hover:bg-red-700 text-white shadow-sm focus:ring-red-500/20',
      border: 'border-red-100 dark:border-red-900/30',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    warning: {
      bg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
      btn: 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm focus:ring-amber-500/20',
      border: 'border-amber-100 dark:border-amber-900/30',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    info: {
      bg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400',
      btn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm focus:ring-indigo-500/20',
      border: 'border-indigo-100 dark:border-indigo-900/30',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
  }[type]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full max-w-md transform rounded-3xl border bg-white p-6 text-left shadow-[0_30px_90px_rgba(15,23,42,0.22)] transition-all animate-vault-morph dark:bg-[#1c1c1e] ${colorConfig.border}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex flex-col gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${colorConfig.bg}`}>
            {colorConfig.icon}
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary dark:text-slate-100">{title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary dark:text-slate-400">{message}</p>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex h-10 flex-1 items-center justify-center rounded-xl border border-black/5 bg-transparent text-xs font-semibold text-text-secondary hover:bg-black/5 active:scale-95 transition-all dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`flex h-10 flex-1 items-center justify-center rounded-xl text-xs font-semibold active:scale-95 transition-all focus:outline-none focus:ring-4 ${colorConfig.btn}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

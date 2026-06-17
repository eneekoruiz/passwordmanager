import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe ser usado dentro de un ToastProvider')
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, type, message }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed top-6 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-2 pointer-events-none">
            {toasts.map((toast) => (
              <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [isExiting, setIsExiting] = useState(false)
  const timerRef = useRef<number>()

  useEffect(() => {
    timerRef.current = window.setTimeout(() => {
      setIsExiting(true)
      setTimeout(onRemove, 300) // tiempo de animación
    }, 4000)
    return () => clearTimeout(timerRef.current)
  }, [onRemove])

  const typeStyles = {
    success: 'bg-green-50/95 border-green-200 text-green-800 shadow-green-900/10',
    error: 'bg-red-50/95 border-red-200 text-red-800 shadow-red-900/10',
    info: 'bg-white/95 border-black/5 text-text-primary shadow-black/10',
    warning: 'bg-amber-50/95 border-amber-200 text-amber-800 shadow-amber-900/10',
  }

  const icons = {
    success: (
      <svg className="h-4 w-4 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    warning: (
      <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="h-4 w-4 shrink-0 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }

  const animationClass = isExiting ? 'animate-fade-out-up scale-95 opacity-0' : 'animate-fade-in-down'

  return (
    <div
      className={`pointer-events-auto flex w-max max-w-[90vw] sm:max-w-md items-center gap-2.5 rounded-2xl border px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-all duration-300 ${typeStyles[toast.type]} ${animationClass}`}
      role="alert"
    >
      {icons[toast.type]}
      <span className="text-[13px] font-semibold leading-snug">{toast.message}</span>
    </div>
  )
}

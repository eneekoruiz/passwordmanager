import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
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

const MAX_VISIBLE_TOASTS = 3
const TOAST_DURATION_MS = 5200
const DISMISS_DRAG_DISTANCE = 30
let toastSequence = 0

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_PRIORITY: Record<ToastType, number> = {
  info: 0,
  success: 1,
  warning: 2,
  error: 3,
}

function normalizeToastMessage(message: string) {
  return message
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¡!¿?.,;:()\[\]{}"']/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function areSimilarToastMessages(a: string, b: string) {
  const first = normalizeToastMessage(a)
  const second = normalizeToastMessage(b)
  if (!first || !second) return false
  if (first === second) return true

  const shorter = first.length <= second.length ? first : second
  const longer = first.length > second.length ? first : second
  return shorter.length >= 18 && longer.includes(shorter) && shorter.length / longer.length > 0.68
}

function strongestToastType(current: ToastType, incoming: ToastType) {
  return TOAST_PRIORITY[incoming] > TOAST_PRIORITY[current] ? incoming : current
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe ser usado dentro de un ToastProvider')
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const cleanMessage = message.trim()
    if (!normalizeToastMessage(cleanMessage)) return

    const id = `toast_${Date.now()}_${toastSequence += 1}`

    setToasts((prev) => {
      const duplicateIndex = prev.findIndex((toast) => areSimilarToastMessages(toast.message, cleanMessage))
      if (duplicateIndex !== -1) {
        const duplicate = prev[duplicateIndex]
        const next = prev.filter((_, index) => index !== duplicateIndex)
        return [
          ...next,
          {
            ...duplicate,
            type: strongestToastType(duplicate.type, type),
            message: duplicate.message.length >= cleanMessage.length ? duplicate.message : cleanMessage,
          },
        ].slice(-MAX_VISIBLE_TOASTS)
      }

      return [...prev, { id, type, message: cleanMessage }].slice(-MAX_VISIBLE_TOASTS)
    })
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed left-1/2 top-4 z-[9999] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col items-stretch gap-2 pointer-events-none sm:top-6">
            {toasts.map((toast) => (
              <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [isExiting, setIsExiting] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)
  const startRef = useRef<{ x: number; y: number } | null>(null)

  const dismiss = useCallback(() => {
    if (isExiting) return
    setIsExiting(true)
    window.setTimeout(onRemove, 220)
  }, [isExiting, onRemove])

  useEffect(() => {
    timerRef.current = window.setTimeout(dismiss, TOAST_DURATION_MS)
    return () => window.clearTimeout(timerRef.current)
  }, [dismiss])

  const typeStyles: Record<ToastType, string> = {
    success: 'border-emerald-200 text-emerald-950 shadow-emerald-900/10 before:bg-emerald-500',
    error: 'border-red-200 text-red-950 shadow-red-900/10 before:bg-red-500',
    info: 'border-slate-200 text-slate-950 shadow-slate-900/10 before:bg-slate-400',
    warning: 'border-amber-200 text-amber-950 shadow-amber-900/10 before:bg-amber-500',
  }

  const iconStyles: Record<ToastType, string> = {
    success: 'bg-emerald-50 text-emerald-600',
    error: 'bg-red-50 text-red-600',
    info: 'bg-slate-100 text-slate-600',
    warning: 'bg-amber-50 text-amber-600',
  }

  const icons: Record<ToastType, ReactNode> = {
    success: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      </svg>
    ),
    warning: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      </svg>
    ),
    info: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  }

  const opacity = dragging ? Math.max(0.35, 1 - (Math.abs(dragX) + Math.abs(dragY)) / 180) : 1
  const exitY = dragY < -20 ? dragY - 100 : -48
  const exitX = Math.abs(dragX) > 20 ? (dragX > 0 ? dragX + 150 : dragX - 150) : dragX
  const transform = isExiting
    ? `translate3d(${exitX}px, ${exitY}px, 0) scale(0.92)`
    : `translate3d(${dragX}px, ${dragY}px, 0)`

  return (
    <div
      className={`pointer-events-auto relative flex min-h-14 w-full touch-none select-none items-start gap-3 overflow-hidden rounded-2xl border bg-white/95 px-3.5 py-3 shadow-[0_14px_44px_rgba(15,23,42,0.14)] backdrop-blur-xl transition-[opacity,transform] before:absolute before:inset-y-0 before:left-0 before:w-1 ${typeStyles[toast.type]} ${isExiting ? 'opacity-0' : 'animate-fade-in-down'}`}
      style={{ transform, opacity, transitionDuration: dragging ? '0ms' : '220ms' }}
      role="status"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('button')) return
        startRef.current = { x: event.clientX, y: event.clientY }
        setDragging(true)
        window.clearTimeout(timerRef.current)
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!startRef.current) return
        setDragX(event.clientX - startRef.current.x)
        setDragY(Math.min(0, event.clientY - startRef.current.y))
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId)
        setDragging(false)
        if (Math.abs(dragX) > DISMISS_DRAG_DISTANCE || dragY < -DISMISS_DRAG_DISTANCE) {
          dismiss()
          return
        }
        setDragX(0)
        setDragY(0)
        timerRef.current = window.setTimeout(dismiss, TOAST_DURATION_MS)
      }}
      onPointerCancel={() => {
        setDragging(false)
        setDragX(0)
        setDragY(0)
        timerRef.current = window.setTimeout(dismiss, TOAST_DURATION_MS)
      }}
    >
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${iconStyles[toast.type]}`}>
        {icons[toast.type]}
      </span>
      <span className="min-w-0 flex-1 pt-0.5 text-[13px] font-semibold leading-snug">
        {toast.message}
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        aria-label="Cerrar notificación"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

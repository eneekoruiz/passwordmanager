import { useState, useRef, useEffect } from 'react'
import type { Platform } from '../../crypto/vault'

interface WeakPasswordWarningPopoverProps {
  platform: Platform
  onIgnore: () => void
  onDisableGlobally: () => void
  className?: string
}

export function WeakPasswordWarningPopover({ platform, onIgnore, onDisableGlobally, className = '' }: WeakPasswordWarningPopoverProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className={`relative ${className}`} ref={containerRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-amber-500 hover:text-amber-600 transition-colors focus:outline-none"
        title="Contraseña débil o insegura"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 z-50 rounded-2xl bg-white border border-black/5 p-3 shadow-[0_15px_40px_rgba(0,0,0,0.12)] animate-in zoom-in-95 duration-150">
          <h4 className="text-sm font-bold text-slate-900">Alerta de Seguridad</h4>
          <p className="mt-1 text-xs text-slate-600">Esta contraseña es débil o ha sido reutilizada en otra plataforma.</p>
          <div className="mt-3 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => {
                onIgnore()
                setOpen(false)
              }}
              className="w-full rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors text-left"
            >
              Ignorar para esta cuenta
            </button>
            <button
              type="button"
              onClick={() => {
                onDisableGlobally()
                setOpen(false)
              }}
              className="w-full rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors text-left"
            >
              Desactivar estos avisos
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

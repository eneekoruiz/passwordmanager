import { useState, useRef, useEffect } from 'react'

interface ExposedPasswordWarningPopoverProps {
  onIgnore: () => void
  onDisableGlobally: () => void
  className?: string
}

export function ExposedPasswordWarningPopover({ onIgnore, onDisableGlobally, className = '' }: ExposedPasswordWarningPopoverProps) {
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

  const positioned = /(?:^|\s)(absolute|fixed|sticky)(?:\s|$)/.test(className)

  return (
    <div className={`${positioned ? '' : 'relative'} ${className}`} ref={containerRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-red-500 hover:text-red-600 transition-colors focus:outline-none"
        title="Contraseña filtrada o expuesta"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-1.998A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-6 mt-2 w-64 max-w-[calc(100vw-2rem)] z-50 rounded-2xl bg-white border border-black/5 p-3 shadow-[0_15px_40px_rgba(0,0,0,0.12)] animate-in zoom-in-95 duration-150 dark:bg-slate-800 dark:border-white/10">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Alerta de Exposición</h4>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Esta contraseña ha aparecido en una filtración de datos conocida.</p>
          <div className="mt-3 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => {
                onIgnore()
                setOpen(false)
              }}
              className="w-full rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-left"
            >
              Ignorar para esta cuenta
            </button>
            <button
              type="button"
              onClick={() => {
                onDisableGlobally()
                setOpen(false)
              }}
              className="w-full rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
            >
              Desactivar auditorías globales
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

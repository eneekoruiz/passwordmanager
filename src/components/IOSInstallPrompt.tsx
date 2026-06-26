import { useState, useEffect } from 'react'

export function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Detectar si es iOS (iPhone, iPad, iPod)
    const isIOS =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 0 && navigator.userAgent.includes('Macintosh'))

    // 2. Detectar si ya está instalada (en modo standalone)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true

    if (isIOS && !isStandalone) {
      // Retrasar ligeramente la aparición para mejorar la UX
      const timer = setTimeout(() => {
        setShowPrompt(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  if (!showPrompt) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl border border-black/5 bg-white/90 backdrop-blur-2xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col gap-5 select-none text-left animate-fade-in font-sans">
        <header className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-text-primary flex items-center justify-center text-white font-bold text-sm shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
            C
          </div>
          <div>
            <h4 className="text-xs font-bold text-text-primary">Instalar Contras</h4>
            <p className="text-[9px] text-text-tertiary font-semibold uppercase tracking-wider">Web App Oficial</p>
          </div>
        </header>

        <p className="text-xs text-text-secondary leading-normal">
          Para usar este gestor de contraseñas de forma segura y evitar que Safari elimine tus datos locales debido a sus políticas estrictas, añade la aplicación a tu pantalla de inicio:
        </p>

        <div className="rounded-xl bg-amber-50 p-3 border border-amber-200">
          <p className="text-xs text-amber-800 font-medium">
            <strong className="font-bold">Aviso Crítico:</strong> Apple bloquea las funciones avanzadas en el navegador web. El desbloqueo con <strong className="font-bold">Face ID / Touch ID</strong> y el <strong className="font-bold">Modo Sin Conexión</strong> no funcionarán hasta que la instales.
          </p>
        </div>

        <div className="space-y-2.5 border-t border-black/[0.05] pt-3.5">
          <div className="flex items-center gap-3 text-xs text-text-primary font-medium">
            <div className="h-7 w-7 rounded-lg bg-surface flex items-center justify-center text-text-secondary shrink-0 border border-black/[0.03]">
              {/* Icono de compartir de iOS */}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <span>
              1. Pulsa el botón de <strong className="font-bold">Compartir</strong> en la barra de Safari.
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-text-primary font-medium">
            <div className="h-7 w-7 rounded-lg bg-surface flex items-center justify-center text-text-secondary shrink-0 border border-black/[0.03]">
              {/* Icono de añadir a la pantalla de inicio de iOS */}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span>
              2. Selecciona <strong className="font-bold">Añadir a la pantalla de inicio</strong>.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

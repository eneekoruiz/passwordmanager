import { useState, useEffect } from 'react'

export function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // 1. Detectar si es iOS (iPhone, iPad, iPod)
    const isIOS =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 0 && navigator.userAgent.includes('Macintosh'))

    // 2. Detectar si ya está instalada (en modo standalone)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true

    // 3. Comprobar si el usuario la cerró anteriormente en esta sesión/navegador
    const isDismissed = localStorage.getItem('contras_ios_install_dismissed') === 'true'

    if (isIOS && !isStandalone && !isDismissed) {
      // Retrasar ligeramente la aparición para mejorar la UX (estilo Apple)
      const timer = setTimeout(() => {
        setShowPrompt(true)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleDismiss = () => {
    localStorage.setItem('contras_ios_install_dismissed', 'true')
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50 rounded-2xl border border-black/5 bg-white/85 backdrop-blur-xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.12)] flex flex-col gap-3.5 select-none text-left animate-fade-in font-sans">
      <header className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-text-primary flex items-center justify-center text-white font-bold text-sm shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
            C
          </div>
          <div>
            <h4 className="text-xs font-bold text-text-primary">Instalar Contras</h4>
            <p className="text-[9px] text-text-tertiary font-semibold uppercase tracking-wider">Web App Oficial</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-full bg-black/[0.04] p-1 text-text-tertiary transition-colors hover:bg-black/[0.08] hover:text-text-primary"
          aria-label="Cerrar aviso"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <p className="text-xs text-text-secondary leading-normal">
        Para usar este gestor de contraseñas de forma segura y sin conexión en tu iPhone, añádelo a tu pantalla de inicio:
      </p>

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
  )
}

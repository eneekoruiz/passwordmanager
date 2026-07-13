import { useState, useEffect } from 'react'

interface VaultLoaderScreenProps {
  isReady: boolean
  onAnimationComplete: () => void
}

export function VaultLoaderScreen({ isReady, onAnimationComplete }: VaultLoaderScreenProps) {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<'counting' | 'waiting' | 'zooming'>('counting')

  useEffect(() => {
    let startTime = Date.now()
    const DURATION = 800 // base duration to reach 100%

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      
      setProgress((prev) => {
        // If not ready, max out at 89%
        const targetMax = isReady ? 100 : 89
        let next = Math.floor((elapsed / DURATION) * 100)
        
        // Ensure it doesn't go backwards and caps at targetMax
        if (next < prev) next = prev + 1
        if (next > targetMax) next = targetMax

        // If it was stuck at 89 and isReady is now true, accelerate to 100
        if (isReady && prev >= 89 && next < 100) {
            next = prev + 2
        }

        if (next >= 100) {
            clearInterval(interval)
            setPhase('waiting')
            setTimeout(() => {
              setPhase('zooming')
            }, 150)
            return 100
        }
        return next
      })

    }, 30)

    return () => clearInterval(interval)
  }, [isReady])

  useEffect(() => {
    if (phase === 'zooming') {
      const timer = setTimeout(() => {
        onAnimationComplete()
      }, 700) // Duration of the zoom animation
      return () => clearTimeout(timer)
    }
  }, [phase, onAnimationComplete])

  return (
    <div 
      className={`vault-shell vault-stage fixed inset-0 z-[9999] flex h-full min-h-screen w-full flex-col items-center justify-center bg-surface transition-opacity duration-700 ${phase === 'zooming' ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      style={{ 
        perspective: '1200px',
      }}
    >
      <div 
        className={`flex flex-col items-center justify-center ${phase === 'zooming' ? 'animate-vault-3d-zoom' : 'animate-vault-morph'}`} 
        role="status" 
        aria-live="polite"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Preloader original con el contador integrado dentro de la órbita */}
        <div 
          className={`vault-loader mb-6 transition-all duration-500 ${phase === 'waiting' ? 'scale-115 shadow-[0_0_40px_rgba(23,213,163,0.35)]' : 'scale-100'}`} 
          aria-hidden="true"
        >
          <div className="text-xl font-black tabular-nums tracking-tight text-white transition-transform duration-300">
            {progress}
          </div>
        </div>

        {/* Textos descriptivos de la carga */}
        <div className="text-center transition-opacity duration-300" style={{ opacity: phase === 'zooming' ? 0 : 1 }}>
          <p className="text-sm font-bold tracking-tight text-text-primary">Abriendo tu bóveda</p>
          <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400">Descifrado local seguro</p>
        </div>
      </div>
    </div>
  )
}


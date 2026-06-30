/**
 * @component BiometricUnlockButton
 * Botón de desbloqueo biométrico (Face ID / Touch ID / Windows Hello).
 * Solo se renderiza si la biometría está disponible y hay una credencial registrada.
 */
import { useState } from 'react'

interface BiometricUnlockButtonProps {
  onUnlock: () => Promise<void>
  onError: (msg: string) => void
}

export function BiometricUnlockButton({ onUnlock, onError }: BiometricUnlockButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      await onUnlock()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de autenticación biométrica.'
      // If cancelled by user, don't show error
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('cancelad')) {
        onError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-black/[0.07] bg-white py-4 text-sm font-semibold text-text-primary shadow-[0_8px_24px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] active:translate-y-0 disabled:opacity-60"
    >
      {/* Background shimmer on hover */}
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/[0.025] to-transparent transition-transform duration-500 group-hover:translate-x-full" />

      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm shadow-slate-900/20 transition-transform duration-200 group-hover:scale-105">
        {loading ? (
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <BiometricIcon />
        )}
      </span>

      <span className="flex flex-col items-start">
        <span className="text-sm font-bold text-text-primary leading-tight">
          {loading ? 'Verificando...' : 'Usar llave local'}
        </span>
        <span className="text-[11px] font-medium text-text-tertiary leading-tight">
          Passkey local · Face ID · Huella
        </span>
      </span>
    </button>
  )
}

function BiometricIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" />
    </svg>
  )
}

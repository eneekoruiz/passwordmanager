import { useState, useEffect } from 'react'
import * as OTPAuth from 'otpauth'
import { copyToClipboard } from '../../utils/clipboard'
import { useToast } from './ToastProvider'

interface TotpDisplayProps {
  secret: string
  label?: string
}

export function TotpDisplay({ secret, label = 'Authenticator' }: TotpDisplayProps) {
  const [token, setToken] = useState('')
  const [period, setPeriod] = useState(30)
  const [timeLeft, setTimeLeft] = useState(30)
  const [copied, setCopied] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    let totp: OTPAuth.TOTP | null = null

    try {
      // Intenta decodificar el secreto. otpauth maneja secretos base32 por defecto.
      // Quitar espacios si los hay.
      const cleanSecret = secret.replace(/\s+/g, '').toUpperCase()
      
      totp = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(cleanSecret)
      })
    } catch (e) {
      console.warn("Invalid TOTP secret", e)
      return
    }

    const updateToken = () => {
      if (!totp) return
      setToken(totp.generate())
      const secondsLeft = totp.period - (Math.floor(Date.now() / 1000) % totp.period)
      setTimeLeft(secondsLeft)
      setPeriod(totp.period)
    }

    updateToken()
    const interval = setInterval(updateToken, 1000)

    return () => clearInterval(interval)
  }, [secret])

  const handleCopy = async () => {
    if (!token) return
    const ok = await copyToClipboard(token)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } else {
      showToast('No se pudo copiar el código', 'error')
    }
  }

  if (!token) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mt-3">
        <p className="text-xs text-amber-800">Secreto TOTP inválido o formato incorrecto.</p>
      </div>
    )
  }

  const progressPercentage = (timeLeft / period) * 100
  const isUrgent = timeLeft <= 5

  return (
    <div className="relative overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.02)] transition-all hover:shadow-md mt-4">
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</p>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold ${isUrgent ? 'text-red-500 animate-pulse' : 'text-text-tertiary'}`}>
              {timeLeft}s
            </span>
            <div className="h-4 w-4 relative">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" className="stroke-black/5" strokeWidth="4" />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  className={isUrgent ? 'stroke-red-500' : 'stroke-indigo-500'}
                  strokeWidth="4"
                  strokeDasharray="100 100"
                  strokeDashoffset={100 - progressPercentage}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between gap-3">
          <div className="font-mono text-2xl sm:text-3xl tracking-[0.2em] font-light text-text-primary">
            {token.slice(0, 3)} {token.slice(3)}
          </div>
          
          <button
            type="button"
            onClick={handleCopy}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-hover px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-black/5 hover:text-text-primary active:scale-95"
            title="Copiar código"
          >
            {copied ? (
              <span className="font-bold text-green-600">Copiado</span>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
                <span className="hidden sm:inline">Copiar</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      <div 
        className={`h-1 absolute bottom-0 left-0 transition-all duration-1000 ease-linear ${isUrgent ? 'bg-red-500' : 'bg-indigo-500'}`}
        style={{ width: `${progressPercentage}%` }}
      />
    </div>
  )
}

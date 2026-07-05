import { useEffect, useState, useMemo } from 'react'
import * as OTPAuth from 'otpauth'
interface TotpDisplayProps {
  secret: string
  revealed?: boolean
  onCopy?: () => void
}

export function TotpDisplay({ secret, revealed = false, onCopy }: TotpDisplayProps) {
  const [token, setToken] = useState('')
  const [progress, setProgress] = useState(100)
  const [copied, setCopied] = useState(false)

  const totp = useMemo(() => {
    try {
      if (!secret) return null
      // Soportar tanto base32 directo como URI otpauth://
      if (secret.startsWith('otpauth://')) {
        return OTPAuth.URI.parse(secret)
      }
      return new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(secret.replace(/\s+/g, '').toUpperCase()),
      })
    } catch {
      return null
    }
  }, [secret])

  useEffect(() => {
    if (!totp || !revealed) return

    const updateToken = () => {
      try {
        const newToken = totp.generate()
        setToken(newToken)
      } catch {
        // Ignorar si falla la generacion
      }
    }

    const updateProgress = () => {
      const now = Date.now() / 1000
      const period = totp instanceof OTPAuth.TOTP ? totp.period : 30
      const remain = period - (now % period)
      setProgress((remain / period) * 100)
      if (Math.abs(remain - period) < 1) {
        updateToken()
      }
    }

    updateToken()
    updateProgress()
    
    // Update progress frequently for smooth bar
    const interval = setInterval(updateProgress, 100)
    return () => clearInterval(interval)
  }, [totp, revealed])

  const handleCopy = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      onCopy?.()
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  if (!totp) {
    return <span className="text-red-500 font-semibold text-sm break-all">{secret} (Formato TOTP inválido)</span>
  }

  if (!revealed) {
    return <span className="text-base font-semibold text-text-primary tracking-widest font-mono">••••••••••••</span>
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      <div className="flex items-center justify-between gap-4">
        <span className="text-2xl font-mono font-black tracking-widest text-text-primary bg-slate-100 px-3 py-1.5 rounded-lg border border-black/5">
          {token.slice(0, 3)} {token.slice(3)}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-surface hover:bg-surface-active text-text-secondary border border-black/5'}`}
        >
          {copied ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
        </button>
      </div>
      <div className="w-full h-1 bg-slate-200/60 rounded-full overflow-hidden mt-1">
        <div 
          className={`h-full transition-all duration-100 ease-linear ${progress < 15 ? 'bg-red-500' : progress < 30 ? 'bg-amber-500' : 'bg-indigo-500'}`} 
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

import { useState, useRef, type ChangeEvent, type KeyboardEvent } from 'react'

const PIN_LENGTH = 6
const PIN_STORAGE_KEY = 'contras.pin.hash'
const PIN_SALT_KEY = 'contras.pin.salt'

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: 200000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptMasterPassword(pin: string, masterPassword: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(pin, salt)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(masterPassword))
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength)
  combined.set(salt, 0)
  combined.set(iv, 16)
  combined.set(new Uint8Array(ciphertext), 28)
  const b64 = btoa(String.fromCharCode(...combined))
  localStorage.setItem(PIN_STORAGE_KEY, b64)
  localStorage.setItem(PIN_SALT_KEY, Date.now().toString())
}

async function decryptWithPin(pin: string): Promise<string | null> {
  const b64 = localStorage.getItem(PIN_STORAGE_KEY)
  if (!b64) return null
  try {
    const combined = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    const salt = combined.slice(0, 16)
    const iv = combined.slice(16, 28)
    const ciphertext = combined.slice(28)
    const key = await deriveKey(pin, salt)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return new TextDecoder().decode(decrypted)
  } catch {
    return null
  }
}

export function isPinRegistered(): boolean {
  return Boolean(localStorage.getItem(PIN_STORAGE_KEY))
}

export function clearPin(): void {
  localStorage.removeItem(PIN_STORAGE_KEY)
  localStorage.removeItem(PIN_SALT_KEY)
}

interface PinInputProps {
  onComplete: (pin: string) => void
  label?: string
  error?: string | null
  loading?: boolean
}

function PinInput({ onComplete, label, error, loading }: PinInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''))
  const refs = useRef<Array<HTMLInputElement | null>>([])

  const handleChange = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 1)
    const next = [...digits]
    next[i] = val
    setDigits(next)
    if (val && i < PIN_LENGTH - 1) refs.current[i + 1]?.focus()
    if (next.every(d => d)) onComplete(next.join(''))
  }

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH)
    if (pasted.length === PIN_LENGTH) {
      setDigits(pasted.split(''))
      onComplete(pasted)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {label && <p className="text-sm font-semibold text-text-primary">{label}</p>}
      <div className="flex gap-2" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => { refs.current[i] = el }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleChange(i, e)}
            onKeyDown={e => handleKeyDown(i, e)}
            className={`h-12 w-10 rounded-xl border text-center text-lg font-bold outline-none transition-all
              ${d ? 'border-black/20 bg-white text-text-primary' : 'border-black/10 bg-surface text-text-tertiary'}
              focus:border-black/30 focus:ring-2 focus:ring-black/5
              ${error ? 'border-red-300' : ''}
            `}
            disabled={loading}
            autoFocus={i === 0}
          />
        ))}
      </div>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      {loading && <p className="text-xs text-text-tertiary">Verificando...</p>}
    </div>
  )
}

interface QuickPinSetupProps {
  masterPassword: string
  onSuccess: () => void
  onCancel: () => void
}

export function QuickPinSetup({ masterPassword, onSuccess, onCancel }: QuickPinSetupProps) {
  const [step, setStep] = useState<'set' | 'confirm'>('set')
  const [firstPin, setFirstPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleFirst = (pin: string) => {
    setFirstPin(pin)
    setStep('confirm')
  }

  const handleConfirm = async (pin: string) => {
    if (pin !== firstPin) {
      setError('Los PINs no coinciden. Inténtalo de nuevo.')
      setStep('set')
      setFirstPin('')
      return
    }
    setSaving(true)
    try {
      await encryptMasterPassword(pin, masterPassword)
      onSuccess()
    } catch {
      setError('Error al guardar el PIN. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 leading-relaxed">
        <strong>PIN de desbloqueo rápido</strong> — alternativa a la biometría. Tu Contraseña Maestra se cifra localmente con este PIN. <strong>El PIN nunca sale del dispositivo.</strong>
      </div>
      {step === 'set' ? (
        <PinInput
          label="Elige tu PIN de 6 dígitos"
          onComplete={handleFirst}
          error={error}
        />
      ) : (
        <PinInput
          label="Confirma tu PIN"
          onComplete={handleConfirm}
          loading={saving}
        />
      )}
      <button
        type="button"
        onClick={onCancel}
        className="text-sm text-text-tertiary underline underline-offset-2 hover:text-text-secondary"
      >
        Cancelar
      </button>
    </div>
  )
}

interface QuickPinUnlockProps {
  /** Called with the decrypted master password on success */
  onSuccess: (masterPassword: string) => void
  onCancel: () => void
  onForget: () => void
}

export function QuickPinUnlock({ onSuccess, onCancel, onForget }: QuickPinUnlockProps) {
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [loading, setLoading] = useState(false)

  const handlePin = async (pin: string) => {
    setLoading(true)
    setError(null)
    try {
      const masterPassword = await decryptWithPin(pin)
      if (masterPassword) {
        onSuccess(masterPassword)
      } else {
        const next = attempts + 1
        setAttempts(next)
        if (next >= 5) {
          clearPin()
          onForget()
        } else {
          setError(`PIN incorrecto. ${5 - next} intentos restantes.`)
        }
      }
    } catch {
      setError('Error al verificar el PIN.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/5 text-2xl">
        🔢
      </div>
      <PinInput
        label="Introduce tu PIN de desbloqueo"
        onComplete={handlePin}
        error={error}
        loading={loading}
      />
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-text-tertiary underline underline-offset-2 hover:text-text-secondary"
        >
          Usar Contraseña Maestra
        </button>
        <button
          type="button"
          onClick={() => { clearPin(); onForget() }}
          className="text-xs text-red-400 hover:text-red-600"
        >
          Olvidé mi PIN / Eliminar PIN
        </button>
      </div>
    </div>
  )
}

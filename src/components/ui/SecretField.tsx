import { useEffect, useState, type CSSProperties } from 'react'
import { copyToClipboard } from '../../utils/clipboard'
import { inputClassName } from './FormField'
import { useVault } from '../../context/VaultContext'
import { useToast } from './ToastProvider'

interface SecretFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  multiline?: boolean
}

export function SecretField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: SecretFieldProps) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const { authorizeSensitiveAction } = useVault()
  const { showToast } = useToast()

  useEffect(() => {
    if (!visible) return
    const timer = window.setTimeout(() => setVisible(false), 2 * 60 * 1000)
    return () => window.clearTimeout(timer)
  }, [visible])

  const authenticate = async () => {
    return await authorizeSensitiveAction()
  }

  const handleReveal = async () => {
    if (visible) {
      setVisible(false)
      return
    }
    if (await authenticate()) setVisible(true)
  }

  const handleCopy = async () => {
    if (!(await authenticate())) return
    const ok = await copyToClipboard(value)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } else {
      showToast('No se pudo acceder al portapapeles.', 'error')
    }
  }

  const fieldClass = `${inputClassName} pr-20 font-mono text-base ${multiline ? 'min-h-[88px] resize-y' : ''}`

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">
        {label}
      </span>
      <div className="relative">
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={fieldClass}
            style={
              !visible
                ? ({ WebkitTextSecurity: 'disc' } as CSSProperties)
                : undefined
            }
          />
        ) : (
          <input
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={fieldClass}
          />
        )}
        <div className="absolute right-1 top-1.5 flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => void handleReveal()}
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary"
            aria-label={visible ? 'Ocultar' : 'Mostrar'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {visible ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              ) : (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </>
              )}
            </svg>
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={!value}
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary disabled:opacity-40"
            aria-label="Copiar"
          >
            {copied ? (
              <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.102.124 1.99 1.003 1.99 2.122v6.228a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 18.75v-6.228c0-1.12.888-2.002 1.99-2.122A48.394 48.394 0 0112 3c.775 0 1.545.09 2.298.266" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </label>
  )
}

import { useState, useEffect } from 'react'
import { copyToClipboard } from '../../utils/clipboard'
import { inputClassName } from './FormField'

/**
 * @interface PasswordFieldProps
 * @description Propiedades del componente PasswordField.
 */
interface PasswordFieldProps {
  /** Etiqueta de texto descriptiva para el campo */
  label: string
  /** Valor de la contraseña en texto plano */
  value: string
  /** Callback para notificar cambios en el valor de la contraseña */
  onChange: (value: string) => void
  /** Placeholder opcional */
  placeholder?: string
  /** Indica si el campo es obligatorio en el formulario */
  required?: boolean
  /** Deshabilita edición cuando el secreto no usa contraseña */
  disabled?: boolean
  /** Si es true, renderiza el botón sutil de generación de contraseñas y su panel */
  showGenerator?: boolean
  /** Si es true, fuerza la visibilidad ignorando el estado interno (usado por desbloqueo global) */
  forceVisible?: boolean
}

/**
 * Genera una contraseña segura de forma criptográficamente aleatoria en el cliente.
 * Garantiza la inclusión de al menos un carácter de cada tipo seleccionado.
 *
 * @param {number} length - Longitud de la contraseña a generar.
 * @param {boolean} uppercase - Incluir mayúsculas (A-Z).
 * @param {boolean} numbers - Incluir números (0-9).
 * @param {boolean} symbols - Incluir símbolos especiales.
 * @returns {string} Contraseña segura resultante.
 */
function generateSecurePassword(
  length: number,
  uppercase: boolean,
  numbers: boolean,
  symbols: boolean,
): string {
  const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz'
  const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numberChars = '0123456789'
  const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?'

  let chars = lowercaseChars
  if (uppercase) chars += uppercaseChars
  if (numbers) chars += numberChars
  if (symbols) chars += symbolChars

  if (chars.length === 0) return ''

  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length]
  }

  // Comprobación de calidad: asegurar que cumpla los requisitos
  const minRequired = (uppercase ? 1 : 0) + (numbers ? 1 : 0) + (symbols ? 1 : 0) + 1
  if (length >= minRequired) {
    let hasUpper = !uppercase
    let hasNumber = !numbers
    let hasSymbol = !symbols

    for (const c of password) {
      if (uppercaseChars.includes(c)) hasUpper = true
      if (numberChars.includes(c)) hasNumber = true
      if (symbolChars.includes(c)) hasSymbol = true
    }

    if (!(hasUpper && hasNumber && hasSymbol)) {
      // Reintentar de forma recursiva (eficiente en JS debido a la baja probabilidad de fallo repetido)
      return generateSecurePassword(length, uppercase, numbers, symbols)
    }
  }

  return password
}

const PASSPHRASE_WORDS = [
  'bruma', 'norte', 'cristal', 'mapa', 'luna', 'cedro', 'puente', 'nube',
  'rio', 'faro', 'atlas', 'cobre', 'valle', 'piano', 'delta', 'bambu',
  'sol', 'trazo', 'marea', 'verde', 'roble', 'ambar', 'cima', 'eco',
]

function generatePassphrase(wordCount: number, separator = '-'): string {
  const bytes = new Uint8Array(wordCount)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => PASSPHRASE_WORDS[byte % PASSPHRASE_WORDS.length]).join(separator)
}

/**
 * Componente de campo de contraseña interactivo con soporte de visibilidad, copiado
 * rápido al portapapeles y generador integrado de contraseñas seguras (Apple-style).
 */
export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  required,
  disabled,
  showGenerator = false,
  forceVisible = false,
}: PasswordFieldProps) {
  const [internalVisible, setInternalVisible] = useState(false)
  const visible = forceVisible || internalVisible
  const [copied, setCopied] = useState(false)
  
  // Estados de control del generador
  const [showGeneratorMenu, setShowGeneratorMenu] = useState(false)
  const [length, setLength] = useState(16)
  const [useUppercase, setUseUppercase] = useState(true)
  const [useNumbers, setUseNumbers] = useState(true)
  const [useSymbols, setUseSymbols] = useState(true)
  const [generatorMode, setGeneratorMode] = useState<'password' | 'passphrase'>('password')
  const [wordCount, setWordCount] = useState(4)

  // Scrubbing: Asegurar la limpieza del menú de generación al desmontar
  useEffect(() => {
    return () => {
      setShowGeneratorMenu(false)
    }
  }, [])

  const handleCopy = async () => {
    const ok = await copyToClipboard(value)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const handleGenerate = (len: number, up: boolean, num: boolean, sym: boolean) => {
    onChange(generatorMode === 'passphrase' ? generatePassphrase(wordCount) : generateSecurePassword(len, up, num, sym))
  }

  const prClassName = showGenerator ? 'pr-36' : 'pr-24'

  return (
    <label className="block relative">
      <span className="mb-1.5 block text-xs font-semibold text-text-secondary">
        {label}
      </span>
      <div className="relative flex items-stretch">
        {visible ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            rows={Math.max(1, Math.min(4, Math.ceil((value || '').length / 25)))}
            className={`${inputClassName} ${prClassName} font-mono text-base tracking-wide resize-none py-2.5 h-auto min-h-11`}
          />
        ) : (
          <input
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className={`${inputClassName} ${prClassName} font-mono text-base tracking-wide`}
          />
        )}

        {/* Burbuja de feedback de copiado al estilo iOS/macOS */}
        {copied && (
          <span className="absolute -top-7 right-2 bg-text-primary text-white text-[10px] font-medium px-2 py-0.5 rounded shadow-sm animate-fade-in pointer-events-none transition-opacity">
            Copiado
          </span>
        )}

        <div className={`absolute right-1.5 ${visible ? 'top-1.5' : 'top-1/2 -translate-y-1/2'} flex items-center gap-0.5 z-10`}>
          {showGenerator && (
          <button
            type="button"
            onClick={() => {
                setShowGeneratorMenu((v) => {
                  const next = !v
                  if (next && !value) {
                    handleGenerate(length, useUppercase, useNumbers, useSymbols)
                  }
                  return next
                })
            }}
            disabled={disabled}
            className={`group relative rounded-md p-1.5 active:scale-95 transition-all duration-150 ${
                showGeneratorMenu
                  ? 'bg-surface-active text-text-primary'
                  : 'text-text-tertiary hover:bg-surface-hover hover:text-text-secondary'
              }`}
              aria-label="Generar contraseña"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.904-4.452a3 3 0 114.242-4.243L17.25 15.75m-7.437.154L4 12l8.904-4.452a3 3 0 114.242-4.243L13.25 7.75" />
              </svg>
              <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap shadow-lg">Generar</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setInternalVisible(!internalVisible); }}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-black/10 ${visible ? 'text-black hover:bg-black/5' : 'text-text-tertiary hover:bg-surface-hover'} hover:text-text-secondary active:scale-95 transition-all duration-150`}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {visible ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap shadow-lg">{visible ? 'Ocultar' : 'Mostrar'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!value || disabled}
            className="group relative rounded-md p-1.5 text-text-tertiary hover:bg-surface-hover hover:text-text-secondary active:scale-95 transition-all duration-150 disabled:opacity-40"
            aria-label="Copiar al portapapeles"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.646.049 1.288.11 1.927.184 1.102.124 1.99 1.003 1.99 2.122v6.228a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 18.75v-6.228c0-1.12.888-2.002 1.99-2.122A48.394 48.394 0 0112 3c.775 0 1.545.09 2.298.266" />
            </svg>
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap shadow-lg">Copiar</span>
          </button>
        </div>
      </div>

      {/* Popover del Generador (Apple-style Glassmorphism) */}
      {showGenerator && showGeneratorMenu && (
        <>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowGeneratorMenu(false)}
            className="fixed inset-0 z-40 cursor-default outline-none"
            aria-label="Cerrar opciones de generación"
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl border border-black/5 bg-white/80 backdrop-blur-xl p-4 shadow-[0_10px_35px_rgba(0,0,0,0.06)] text-left space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">
                Generador seguro
              </span>
              <button
                type="button"
                onClick={() => handleGenerate(length, useUppercase, useNumbers, useSymbols)}
                className="rounded-md p-1 text-text-secondary hover:bg-black/5 hover:text-text-primary active:scale-90 transition-all duration-150"
                title="Regenerar"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-xl border border-black/[0.06] bg-surface p-1">
              {(['password', 'passphrase'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setGeneratorMode(mode)
                    onChange(mode === 'passphrase' ? generatePassphrase(wordCount) : generateSecurePassword(length, useUppercase, useNumbers, useSymbols))
                  }}
                  className={`rounded-lg px-2 py-1.5 text-[11px] font-bold transition-all ${
                    generatorMode === mode ? 'bg-text-primary text-white shadow-sm' : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {mode === 'password' ? 'Contraseña' : 'Frase'}
                </button>
              ))}
            </div>

            {/* Deslizador de Longitud */}
            {generatorMode === 'password' ? <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-medium text-text-secondary">
                <span>Longitud</span>
                <span className="font-mono text-text-primary font-semibold">{length}</span>
              </div>
              <input
                type="range"
                min="8"
                max="64"
                value={length}
                onChange={(e) => {
                  const len = parseInt(e.target.value)
                  setLength(len)
                  handleGenerate(len, useUppercase, useNumbers, useSymbols)
                }}
                className="w-full h-1 bg-black/5 rounded-lg appearance-none cursor-pointer accent-text-primary focus:outline-none"
              />
            </div> : (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-text-secondary">
                  <span>Palabras</span>
                  <span className="font-mono text-text-primary font-semibold">{wordCount}</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="8"
                  value={wordCount}
                  onChange={(e) => {
                    const count = parseInt(e.target.value)
                    setWordCount(count)
                    onChange(generatePassphrase(count))
                  }}
                  className="w-full h-1 bg-black/5 rounded-lg appearance-none cursor-pointer accent-text-primary focus:outline-none"
                />
                <p className="text-[10px] leading-relaxed text-text-tertiary">Frases memorables, largas y robustas para cuentas donde tengas que escribir a mano.</p>
              </div>
            )}

            {/* Opciones con interruptores premium (estilo iOS/macOS) */}
            {generatorMode === 'password' && <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Mayúsculas (A-Z)</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !useUppercase
                    setUseUppercase(next)
                    handleGenerate(length, next, useNumbers, useSymbols)
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    useUppercase ? 'bg-text-primary' : 'bg-black/5'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      useUppercase ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Números (0-9)</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !useNumbers
                    setUseNumbers(next)
                    handleGenerate(length, useUppercase, next, useSymbols)
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    useNumbers ? 'bg-text-primary' : 'bg-black/5'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      useNumbers ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Símbolos (!@#...)</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !useSymbols
                    setUseSymbols(next)
                    handleGenerate(length, useUppercase, useNumbers, next)
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    useSymbols ? 'bg-text-primary' : 'bg-black/5'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      useSymbols ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>}
          </div>
        </>
      )}
    </label>
  )
}

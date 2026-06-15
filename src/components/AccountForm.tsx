import { useState, useEffect, type FormEvent, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import type { Account, ApiKeyEntry, SsoProvider } from '../types'
import { createEmptyAccount } from '../utils/account'
import { createApiKeyEntry, normalizeAccount } from '../utils/normalizeAccount'
import { Accordion } from './ui/Accordion'
import { FormField, FormTextarea } from './ui/FormField'
import { PasswordField } from './ui/PasswordField'
import { copyToClipboard } from '../utils/clipboard'
import { getFriendlyErrorMessage } from '../utils/errors'
import { PlatformLogo } from './ui/PlatformLogo'

interface AccountFormProps {
  mode: 'create' | 'edit'
  identityEmail: string
  initialAccount?: Account
  onSave: (account: Account) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
}

interface ApiKeyItemProps {
  keyEntry: ApiKeyEntry
  updateApiKey: (id: string, field: 'nombre' | 'descripcion' | 'valor', value: string) => void
  removeApiKey: (id: string) => void
}

function ApiKeyItem({ keyEntry, updateApiKey, removeApiKey }: ApiKeyItemProps) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const ok = await copyToClipboard(keyEntry.valor)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:shadow-md transition-all duration-200 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          {/* Input para Nombre (Negrita) */}
          <input
            type="text"
            value={keyEntry.nombre}
            onChange={(e) => updateApiKey(keyEntry.id, 'nombre', e.target.value)}
            placeholder="Nombre de la API Key"
            className="w-full bg-transparent font-bold text-xs text-text-primary placeholder:text-text-tertiary outline-none border-b border-transparent focus:border-border-subtle pb-0.5"
          />
          {/* Input para Descripción (Gris sutil) */}
          <input
            type="text"
            value={keyEntry.descripcion}
            onChange={(e) => updateApiKey(keyEntry.id, 'descripcion', e.target.value)}
            placeholder="Añade una descripción breve..."
            className="w-full bg-transparent text-[10px] text-text-secondary placeholder:text-text-tertiary outline-none border-b border-transparent focus:border-border-subtle pb-0.5"
          />
        </div>
        {/* Botón Eliminar Key */}
        <button
          type="button"
          onClick={() => removeApiKey(keyEntry.id)}
          className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-red-50 hover:text-red-600 active:scale-95 shrink-0"
          aria-label="Eliminar clave API"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Input para Valor (Oculto por defecto con botones rápidos) */}
      <div className="relative rounded-xl border border-black/[0.03] bg-surface/85 px-3 py-2 flex items-center gap-2">
        <input
          type={visible ? 'text' : 'password'}
          value={keyEntry.valor}
          onChange={(e) => updateApiKey(keyEntry.id, 'valor', e.target.value)}
          placeholder="Clave API (ej. sk-...)"
          className="w-full bg-transparent text-[11px] font-mono text-text-primary outline-none pr-16"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="rounded-md p-1 text-text-tertiary transition-colors hover:text-text-secondary active:scale-95"
            aria-label={visible ? 'Ocultar' : 'Mostrar'}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            onClick={handleCopy}
            disabled={!keyEntry.valor}
            className="rounded-md p-1 text-text-tertiary transition-colors hover:text-text-secondary active:scale-95 disabled:opacity-45"
            aria-label="Copiar"
          >
            {copied ? (
              <span className="text-[9px] text-green-600 font-bold px-1 select-none animate-fade-in">Copied</span>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

const CopyIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.646.049 1.288.11 1.927.184 1.102.124 1.99 1.003 1.99 2.122v6.228a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 18.75v-6.228c0-1.12.888-2.002 1.99-2.122A48.394 48.394 0 0112 3c.775 0 1.545.09 2.298.266" />
  </svg>
)

function ReadOnlyField({ label, value, isSecret = false, isMultiline = false }: { label: string; value: string | null | undefined; isSecret?: boolean; isMultiline?: boolean }) {
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(!isSecret)
  if (!value) return null

  const handleCopy = async (e?: MouseEvent) => {
    if (e) e.stopPropagation()
    const ok = await copyToClipboard(value)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="group relative flex flex-col gap-1.5 rounded-2xl border border-black/[0.03] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.015)] transition-all duration-300 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:border-black/10 hover:-translate-y-[1px]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</span>
        {isSecret && (
          <button type="button" onClick={() => setRevealed(!revealed)} className="text-[10px] font-bold text-text-tertiary hover:text-text-primary transition-colors focus:outline-none">
            {revealed ? 'Ocultar' : 'Mostrar'}
          </button>
        )}
      </div>
      {isMultiline ? (
        <div className="mt-0.5 whitespace-pre-wrap font-mono text-xs leading-relaxed text-text-secondary">{value}</div>
      ) : (
        <div className={`pr-10 text-sm font-semibold text-text-primary truncate transition-all duration-300 ${revealed ? '' : 'tracking-widest font-mono translate-y-[1px]'}`}>
          {revealed ? value : '••••••••••••'}
        </div>
      )}
      <button type="button" onClick={handleCopy} className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-xl border p-2 shadow-sm transition-all duration-200 active:scale-90 ${copied ? 'border-green-100 bg-green-50 text-green-600 opacity-100' : 'border-black/5 bg-surface text-text-tertiary opacity-0 hover:bg-surface-hover hover:text-text-primary group-hover:opacity-100'}`} title="Copiar al portapapeles">
        {copied ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : <CopyIcon />}
      </button>
    </div>
  )
}

const SSO_PROVIDERS: Array<{
  name: SsoProvider
  icon: ReactNode
}> = [
  { name: 'Google', icon: <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> },
  { name: 'Apple', icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M15.42 10.27c0-2.3 1.86-3.37 1.94-3.41-1.06-1.56-2.7-1.78-3.3-1.81-1.4-.14-2.75.82-3.48.82-.7 0-1.81-.8-2.94-.78-1.5.02-2.9.87-3.67 2.21-1.56 2.7-.4 6.7.13 8.24.53 1.5 1.16 3.17 2.76 3.12 1.53-.05 2.1-.98 3.96-.98s2.38.98 4 .94c1.64-.04 2.15-1.54 2.68-3.08.62-1.85-.23-2.82-.25-2.84-.04-.02-1.83-.7-1.83-2.43zM14.02 5.09c.84-1.02 1.4-2.45 1.25-3.87-1.22.05-2.7.82-3.56 1.83-.76.88-1.43 2.33-1.25 3.72 1.36.1 2.72-.66 3.56-1.68z"/></svg> },
  { name: 'GitHub', icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"/></svg> },
  { name: 'Microsoft', icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/></svg> },
  { name: 'Facebook', icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
  { name: 'Otro', icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
]

export function AccountForm({
  mode,
  identityEmail,
  initialAccount,
  onSave,
  onCancel,
  onDelete,
}: AccountFormProps) {
  const [account, setAccount] = useState<Account>(
    initialAccount ?? createEmptyAccount(),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(mode === 'create')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const [recoveryCodesVisible, setRecoveryCodesVisible] = useState(false)
  const [recoveryCodesCopied, setRecoveryCodesCopied] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        if (e.key === 'Escape') e.target.blur()
        return
      }

      if (!isEditing && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        setIsEditing(true)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (showDeleteModal) setShowDeleteModal(false)
        else if (isEditing) handleCancelEdit()
        else onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, showDeleteModal])

  const handleCancelEdit = () => {
    if (mode === 'create') {
      onCancel()
    } else {
      setAccount(initialAccount ?? createEmptyAccount())
      setIsEditing(false)
      setError(null)
    }
  }

  const handleCopyRecoveryCodes = async () => {
    const ok = await copyToClipboard(account.recoveryCodes ?? '')
    if (ok) {
      setRecoveryCodesCopied(true)
      setTimeout(() => setRecoveryCodesCopied(false), 1500)
    }
  }

  /**
   * Scrubbing de Memoria: Limpieza explícita del estado del formulario al desmontarse.
   */
  useEffect(() => {
    return () => {
      setAccount({
        id: '',
        type: 'ACCOUNT',
        title: '',
        name: '',
        username: '',
        accessMethods: [],
        hardwareKey: false,
        fullName: null,
        linkedPhone: null,
        twoFactorAuth: null,
        notes: undefined,
        apiKeys: [],
        recoveryCodes: undefined,
        createdAt: '',
        updatedAt: '',
      })
      setError(null)
    }
  }, [])

  const updateField = <K extends keyof Account>(key: K, value: Account[K]) => {
    setAccount((prev) => ({ ...prev, [key]: value }))
  }

  const updateApiKey = (
    id: string,
    field: 'nombre' | 'descripcion' | 'valor',
    value: string,
  ) => {
    setAccount((prev) => ({
      ...prev,
      apiKeys: (prev.apiKeys ?? []).map((key) =>
        key.id === id ? { ...key, [field]: value } : key,
      ),
    }))
  }

  const addApiKey = () => {
    setAccount((prev) => ({
      ...prev,
      apiKeys: [...(prev.apiKeys ?? []), createApiKeyEntry()],
    }))
  }

  const removeApiKey = (id: string) => {
    setAccount((prev) => ({
      ...prev,
      apiKeys: (prev.apiKeys ?? []).filter((key) => key.id !== id),
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const normalized = normalizeAccount(account)
    if (!normalized.name) {
      setError('Indica el nombre de la plataforma.')
      return
    }
    if (normalized.accessMethods.length === 0) {
      setError('Activa al menos una vía de acceso para esta plataforma.')
      return
    }

    setSaving(true)
    try {
      await onSave(normalized)
    } catch (error) {
      setError(getFriendlyErrorMessage(error, 'No se pudo guardar la cuenta.'))
    } finally {
      setSaving(false)
    }
  }

  const apiKeys = account.apiKeys ?? []
  const passwordMethod = account.accessMethods.find((method) => method.type === 'PASSWORD')
  const passkeyEnabled = account.accessMethods.some((method) => method.type === 'PASSKEY')
  const magicLinkMethod = account.accessMethods.find((method) => method.type === 'MAGIC_LINK')
  const ssoMethod = account.accessMethods.find((method) => method.type === 'SSO')

  const setAccessMethods = (updater: (methods: Account['accessMethods']) => Account['accessMethods']) => {
    setAccount((prev) => ({ ...prev, accessMethods: updater(prev.accessMethods) }))
  }

  const togglePassword = (enabled: boolean) => {
    setAccessMethods((methods) =>
      enabled
        ? [...methods, { id: crypto.randomUUID(), type: 'PASSWORD', password: '' }]
        : methods.filter((method) => method.type !== 'PASSWORD'),
    )
  }

  const updatePasswordMethod = (password: string) => {
    setAccessMethods((methods) =>
      methods.map((method) =>
        method.type === 'PASSWORD' ? { ...method, password } : method,
      ),
    )
  }

  const toggleSso = (enabled: boolean) => {
    setAccessMethods((methods) => {
      const filtered = methods.filter((m) => m.type !== 'SSO')
      if (enabled) {
        return [...filtered, { id: crypto.randomUUID(), type: 'SSO', provider: 'Google', email: identityEmail }]
      }
      return filtered
    })
  }

  const updateSsoProvider = (provider: SsoProvider) => {
    setAccessMethods((methods) => methods.map((m) => (m.type === 'SSO' ? { ...m, provider } : m)))
  }

  const updateSsoEmail = (email: string) => {
    setAccessMethods((methods) => methods.map((m) => (m.type === 'SSO' ? { ...m, email: email.trim() || identityEmail } : m)))
  }

  const togglePasskey = (enabled: boolean) => {
    setAccessMethods((methods) =>
      enabled
        ? [...methods, { id: crypto.randomUUID(), type: 'PASSKEY' }]
        : methods.filter((method) => method.type !== 'PASSKEY'),
    )
  }

  const toggleMagicLink = (enabled: boolean) => {
    setAccessMethods((methods) =>
      enabled
        ? [...methods, { id: crypto.randomUUID(), type: 'MAGIC_LINK', email: identityEmail }]
        : methods.filter((method) => method.type !== 'MAGIC_LINK'),
    )
  }

  const updateMagicLinkEmail = (email: string) => {
    setAccessMethods((methods) =>
      methods.map((method) =>
        method.type === 'MAGIC_LINK' ? { ...method, email: email.trim() || identityEmail } : method,
      ),
    )
  }

  // MODO LECTURA (VIEW MODE)
  if (!isEditing) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 pb-24 font-sans animate-vault-morph">
        <div className="flex items-center justify-between rounded-2xl border border-black/[0.06] bg-white/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.055)] backdrop-blur transition-all duration-300 hover:shadow-[0_30px_100px_rgba(0,0,0,0.075)]">
          <div className="flex items-center gap-4">
            <PlatformLogo name={account.name} className="h-12 w-12 shrink-0 rounded-2xl shadow-sm border border-black/5" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">{account.name}</h2>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">Resumen seguro</p>
            </div>
          </div>
          <button type="button" onClick={() => setIsEditing(true)} className="rounded-xl bg-text-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition-all duration-150 hover:-translate-y-0.5 hover:opacity-95 active:scale-[0.98]">
            Editar
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadOnlyField label="Usuario" value={account.username} />
          {passwordMethod && <ReadOnlyField label="Contraseña" value={passwordMethod.password} isSecret />}
          {account.linkedPhone && <ReadOnlyField label="Teléfono vinculado" value={account.linkedPhone} />}
          {ssoMethod && <ReadOnlyField label={`Login con ${ssoMethod.provider}`} value={ssoMethod.email || identityEmail} />}
          {passkeyEnabled && <ReadOnlyField label="Biometría / Passkey" value="Activado" />}
          {magicLinkMethod && <ReadOnlyField label="Magic Link" value={magicLinkMethod.email || identityEmail} />}
          {account.twoFactorAuth && <ReadOnlyField label="2FA / Segundo Factor" value={account.twoFactorAuth} />}
          {account.hardwareKey && <ReadOnlyField label="Llave Física (YubiKey)" value="Activada" />}
        </div>

        {apiKeys.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-text-tertiary px-1 uppercase tracking-wider">API Keys</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {apiKeys.map(key => <ReadOnlyField key={key.id} label={`API Key: ${key.nombre}`} value={key.valor} isSecret />)}
            </div>
          </div>
        )}
        {account.recoveryCodes && (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-text-tertiary px-1 uppercase tracking-wider">Códigos de Recuperación</h3>
            <ReadOnlyField label="Códigos de emergencia" value={account.recoveryCodes} isSecret isMultiline />
          </div>
        )}
        {account.fullName && <ReadOnlyField label="Nombre Completo" value={account.fullName} />}
        {account.notes && <ReadOnlyField label="Notas Adicionales" value={account.notes} isMultiline />}
      </div>
    )
  }

  // MODO EDICIÓN (EDIT MODE)
  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-8 pb-24 select-none font-sans animate-vault-morph">
      {/* Identity-First Banner */}
      <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-surface to-white p-4 border border-border-subtle shadow-sm relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1 bg-text-primary" />
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-text-primary text-white shadow-md">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Identidad Activa</span>
          <span className="text-sm font-bold text-text-primary truncate">{identityEmail}</span>
        </div>
      </div>

      {/* 1. Sección Principal (Credenciales) */}
      <section className="space-y-4">
        <div className="flex flex-col border-b border-border-subtle pb-2 mb-2">
          <h3 className="text-sm font-bold text-text-primary">Credenciales Principales</h3>
          <p className="text-[10px] text-text-tertiary font-medium">Información de acceso básico para esta cuenta.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Plataforma"
            value={account.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Amazon, GitHub, Stripe..."
            autoComplete="off"
          />
          <FormField
            label="Usuario"
            value={account.username}
            onChange={(e) => updateField('username', e.target.value)}
            placeholder="usuario"
            autoComplete="off"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Email asociado"
            type="email"
            value={identityEmail}
            readOnly
            className="text-text-secondary"
          />
          <FormField
            label="Teléfono vinculado"
            type="tel"
            value={account.linkedPhone ?? ''}
            onChange={(e) => updateField('linkedPhone', e.target.value.trim() || null)}
            placeholder="+34 600 000 000"
            autoComplete="off"
          />
        </div>

        <div className="rounded-3xl border border-border-subtle bg-white p-4 shadow-subtle">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-text-primary">Vías de Acceso</h4>
            <p className="mt-0.5 text-[10px] font-medium text-text-tertiary">
              Puedes activar varias formas de entrar en la misma plataforma.
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={Boolean(passwordMethod)}
                onChange={(event) => togglePassword(event.target.checked)}
              />
              Contraseña
            </label>
            {passwordMethod && (
              <PasswordField
                label="Contraseña"
                value={passwordMethod.password}
                onChange={updatePasswordMethod}
                placeholder="••••••••"
                required
                showGenerator
              />
            )}

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                <input
                  type="checkbox"
                  checked={Boolean(ssoMethod)}
                  onChange={(event) => toggleSso(event.target.checked)}
                />
                Login Social (SSO)
              </label>
              {ssoMethod && (
                <div className="pl-6 space-y-3 animate-fade-in">
                  <div className="flex flex-wrap gap-2">
                    {SSO_PROVIDERS.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => updateSsoProvider(p.name)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all active:scale-95 ${
                          ssoMethod.provider === p.name ? 'border-text-primary bg-text-primary text-white shadow-md' : 'border-border-subtle bg-surface hover:bg-surface-hover text-text-secondary'
                        }`}
                      >
                        {p.icon}
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <FormField
                    label="Correo usado en este SSO"
                    type="email"
                    value={ssoMethod.email ?? ''}
                    onChange={(event) => updateSsoEmail(event.target.value)}
                    placeholder={identityEmail}
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Opciones avanzadas / API Keys / Notas */}
      <section className="pt-2">
        <Accordion title="Opciones avanzadas / Seguridad extra">
          <div className="mb-6 mt-3 flex flex-col gap-3 rounded-2xl border border-black/5 bg-surface/50 p-4">
            <h4 className="text-xs font-bold text-text-primary">Otros métodos de acceso</h4>
            <label className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={account.hardwareKey}
                onChange={(event) => updateField('hardwareKey', event.target.checked)}
              />
              Llave Física (YubiKey)
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={passkeyEnabled}
                onChange={(event) => togglePasskey(event.target.checked)}
              />
              Passkey / Biometría
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={Boolean(magicLinkMethod)}
                onChange={(event) => toggleMagicLink(event.target.checked)}
              />
              Magic Link
            </label>
            {magicLinkMethod && (
              <FormField label="Correo para magic link" type="email" value={magicLinkMethod.email ?? ''} onChange={(event) => updateMagicLinkEmail(event.target.value)} placeholder={identityEmail} autoComplete="off" />
            )}
          </div>

          <div className="space-y-6 pt-3 pb-1">
        <div className="flex items-center justify-between border-b border-border-subtle pb-2">
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-text-primary">API Keys</h3>
            <p className="text-[10px] text-text-tertiary font-medium">Claves de desarrollo cifradas localmente de extremo a extremo.</p>
          </div>
          <button
            type="button"
            onClick={addApiKey}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated hover:bg-surface-hover px-3 py-1.5 text-xs font-semibold text-text-primary shadow-subtle transition-all active:scale-95 duration-150"
          >
            <svg className="h-4 w-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Añadir clave
          </button>
        </div>

        {apiKeys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center bg-surface-elevated/40">
            <p className="text-xs text-text-tertiary">Sin claves API registradas en esta cuenta.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {apiKeys.map((key) => (
              <ApiKeyItem
                key={key.id}
                keyEntry={key}
                updateApiKey={updateApiKey}
                removeApiKey={removeApiKey}
              />
            ))}
          </div>
        )}

      <div className="space-y-3">
        <div className="flex flex-col border-b border-border-subtle pb-2">
          <h3 className="text-sm font-bold text-text-primary">Códigos de Recuperación</h3>
          <p className="text-[10px] text-text-tertiary font-medium">
            Códigos de un solo uso para recuperar acceso si pierdes tu dispositivo 2FA.
          </p>
        </div>

        <div className="relative rounded-2xl border border-red-100/50 bg-red-50/5 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.01)] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-xs text-red-600">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Códigos de Emergencia
            </div>
            
            <div className="flex items-center gap-0.5 bg-white border border-black/5 rounded-lg p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setRecoveryCodesVisible(!recoveryCodesVisible)}
                className="rounded-md p-1.5 text-text-tertiary transition-colors hover:text-text-secondary active:scale-95"
                aria-label={recoveryCodesVisible ? 'Ocultar' : 'Mostrar'}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {recoveryCodesVisible ? (
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
                onClick={handleCopyRecoveryCodes}
                disabled={!account.recoveryCodes}
                className="rounded-md p-1.5 text-text-tertiary transition-colors hover:text-text-secondary active:scale-95 disabled:opacity-45"
                aria-label="Copiar"
              >
                {recoveryCodesCopied ? (
                  <span className="text-[9px] text-green-600 font-bold px-1 select-none animate-fade-in">Copiado</span>
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <textarea
            value={account.recoveryCodes ?? ''}
            onChange={(e) => updateField('recoveryCodes', e.target.value)}
            placeholder="Pega aquí los códigos de recuperación (ej. 1234-5678)..."
            className="w-full min-h-[96px] rounded-xl border border-black/5 bg-white px-3 py-2.5 font-mono text-xs text-text-primary outline-none focus:border-red-200 transition-colors resize-y leading-relaxed"
            style={
              !recoveryCodesVisible
                ? ({ WebkitTextSecurity: 'disc' } as CSSProperties)
                : undefined
            }
          />
        </div>
      </div>
      </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <FormField
                label="Nombre completo"
                value={account.fullName ?? ''}
                onChange={(e) => updateField('fullName', e.target.value.trim() || null)}
                placeholder="Nombre y apellidos usados"
                autoComplete="off"
              />
            </div>
            <FormField
              label="2FA / Segundo factor"
              value={account.twoFactorAuth ?? ''}
              onChange={(e) => updateField('twoFactorAuth', e.target.value.trim() || null)}
              placeholder="Google Authenticator, SMS, Authy..."
              autoComplete="off"
            />
            <FormTextarea
              label="Notas e Información Adicional"
              value={account.notes ?? ''}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Notas libres, Fecha de nacimiento, Respuestas de recuperación..."
            />
          </div>
        </Accordion>
      </section>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-start gap-2 text-left font-medium leading-normal animate-shake">
          <svg className="h-4 w-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-3 border-t border-border-subtle pt-6">
        <div>
          {mode === 'edit' && onDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="text-sm font-semibold text-red-600 hover:text-red-700 active:scale-95 transition-all"
            >
              Eliminar cuenta
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
              onClick={handleCancelEdit}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-text-secondary transition-all hover:bg-surface-hover active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
              className="rounded-xl bg-text-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 active:scale-95"
          >
              {saving ? 'Guardando…' : mode === 'create' ? 'Crear cuenta' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {/* Modal Seguro de Borrado */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-white/90 p-6 shadow-2xl backdrop-blur-xl text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 shadow-sm">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-bold text-text-primary tracking-tight">¿Eliminar definitivamente?</h3>
            <p className="mb-6 text-xs leading-relaxed text-text-secondary">
              ¿Estás seguro de que deseas eliminar esta plataforma? Esta acción no se puede deshacer y borrará permanentemente la contraseña y las API Keys asociadas.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-xl bg-surface-hover px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-active"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); onDelete?.() }}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 shadow-sm shadow-red-600/20"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}

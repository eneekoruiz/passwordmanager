import { useState, useEffect, type FormEvent, type CSSProperties, type MouseEvent } from 'react'
import type { Account, ApiKeyEntry, SsoProvider, TwoFactorConfig, TwoFactorType } from '../types'
import { createEmptyAccount } from '../utils/account'
import { createApiKeyEntry, normalizeAccount } from '../utils/normalizeAccount'
import { Accordion } from './ui/Accordion'
import { FormField, FormTextarea } from './ui/FormField'
import { PasswordField } from './ui/PasswordField'
import { copyToClipboard } from '../utils/clipboard'
import { getFriendlyErrorMessage } from '../utils/errors'
import { PlatformLogo } from './ui/PlatformLogo'
import { Combobox } from './ui/Combobox'
import { POPULAR_SERVICES } from '../data/popularServices'

interface AccountFormProps {
  mode: 'create' | 'edit'
  identityEmail: string
  initialAccount?: Account
  onSave: (account: Account) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
  onUnsavedStateChange?: (dirty: boolean, actions: UnsavedFormActions | null) => void
}

export interface UnsavedFormActions {
  save: () => Promise<void>
  discard: () => void
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
        <div className="flex min-h-12 shrink-0 items-center gap-3">
          {isSecret && (
            <button
              type="button"
              onClick={() => setRevealed(!revealed)}
              className="inline-flex min-h-11 items-center rounded-xl border border-black/5 bg-surface px-4 text-xs font-bold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus:outline-none"
            >
              {revealed ? 'Ocultar' : 'Mostrar'}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 active:scale-90 ${copied ? 'border-green-100 bg-green-50 text-green-600 opacity-100' : 'border-black/5 bg-surface text-text-tertiary hover:bg-surface-hover hover:text-text-primary'}`}
            title="Copiar al portapapeles"
          >
            {copied ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : <CopyIcon />}
          </button>
        </div>
      </div>
      {isMultiline ? (
        <div className="mt-0.5 whitespace-pre-wrap font-mono text-xs leading-relaxed text-text-secondary">{value}</div>
      ) : (
        <div className={`text-base font-semibold text-text-primary truncate transition-all duration-300 ${revealed ? '' : 'tracking-widest font-mono translate-y-[1px]'}`}>
          {revealed ? value : '••••••••••••'}
        </div>
      )}
    </div>
  )
}

const PLATFORM_OPTIONS = POPULAR_SERVICES.map((service) => ({ label: service.name, meta: service.domain }))
const SSO_OPTIONS = [
  'Google',
  'Apple',
  'Microsoft',
  'GitHub',
  'Discord',
  'Okta',
  'LinkedIn',
  'Facebook',
  'Slack',
  'Twitter',
  'Yahoo',
].map((label) => ({ label }))

const checkboxClassName =
  'h-5 w-5 shrink-0 appearance-none rounded-[0.45rem] border border-black/15 bg-white shadow-[inset_0_1px_1px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.06)] transition-all checked:border-text-primary checked:bg-text-primary checked:bg-[url("data:image/svg+xml,%3Csvg_viewBox=%270_0_16_16%27_fill=%27none%27_xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cpath_d=%27M3.5_8.3L6.6_11.3L12.8_4.8%27_stroke=%27white%27_stroke-width=%272.1%27_stroke-linecap=%27round%27_stroke-linejoin=%27round%27/%3E%3C/svg%3E")] checked:bg-center checked:bg-no-repeat focus:outline-none focus:ring-4 focus:ring-black/[0.06]'

const TWO_FACTOR_LABELS: Record<TwoFactorType, string> = {
  NONE: 'Ninguno',
  PIN: 'PIN',
  TOTP: 'App Authenticator (TOTP)',
  SMS: 'SMS',
}

function getTwoFactorConfig(value: Account['twoFactorAuth']): TwoFactorConfig {
  if (!value) return { type: 'NONE', pin: null, secret: null }
  if (typeof value === 'string') return { type: 'TOTP', secret: value, pin: null }
  return { type: value.type, pin: value.pin ?? null, secret: value.secret ?? null }
}

function twoFactorDisplay(value: Account['twoFactorAuth']): string | null {
  const config = getTwoFactorConfig(value)
  if (config.type === 'NONE') return null
  if (config.type === 'PIN') return config.pin ? `PIN: ${config.pin}` : 'PIN'
  if (config.type === 'TOTP') return config.secret ? `TOTP: ${config.secret}` : 'App Authenticator'
  return 'SMS'
}

export function AccountForm({
  mode,
  identityEmail,
  initialAccount,
  onSave,
  onCancel,
  onDelete,
  onUnsavedStateChange,
}: AccountFormProps) {
  const [account, setAccount] = useState<Account>(() => initialAccount ?? createEmptyAccount())
  const [baselineAccount, setBaselineAccount] = useState<Account>(() => initialAccount ?? createEmptyAccount())
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
    onUnsavedStateChange?.(false, null)
    if (mode === 'create') {
      onCancel()
    } else {
      setAccount(baselineAccount)
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
        birthDate: null,
        accountCreatedAt: null,
        linkedPhone: null,
        twoFactorAuth: { type: 'NONE', pin: null, secret: null },
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

  const saveCurrentAccount = async () => {
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
      setBaselineAccount(normalized)
      onUnsavedStateChange?.(false, null)
    } catch (error) {
      setError(getFriendlyErrorMessage(error, 'No se pudo guardar la cuenta.'))
      throw error
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await saveCurrentAccount()
    } catch {
      // El mensaje visible ya se establece en saveCurrentAccount.
    }
  }

  const isDirty = isEditing && JSON.stringify(normalizeAccount(account)) !== JSON.stringify(normalizeAccount(baselineAccount))

  useEffect(() => {
    onUnsavedStateChange?.(isDirty, isDirty ? { save: saveCurrentAccount, discard: handleCancelEdit } : null)
    return () => onUnsavedStateChange?.(false, null)
  }, [isDirty, account, baselineAccount])

  const apiKeys = account.apiKeys ?? []
  const twoFactorConfig = getTwoFactorConfig(account.twoFactorAuth)
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

  const updateTwoFactorType = (type: TwoFactorType) => {
    updateField('twoFactorAuth', type === 'NONE' ? { type: 'NONE', pin: null, secret: null } : { type, pin: null, secret: null })
  }

  const updateTwoFactorDetail = (field: 'pin' | 'secret', value: string) => {
    const next = { ...getTwoFactorConfig(account.twoFactorAuth), [field]: value }
    updateField('twoFactorAuth', next)
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
      <div className="mx-auto w-full max-w-5xl space-y-5 pb-24 font-sans animate-vault-morph">
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
          {twoFactorDisplay(account.twoFactorAuth) && (
            <ReadOnlyField label="2FA / Segundo Factor" value={twoFactorDisplay(account.twoFactorAuth)} isSecret={twoFactorConfig.type !== 'SMS'} />
          )}
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
        {account.birthDate && <ReadOnlyField label="Fecha de nacimiento" value={account.birthDate} />}
        {account.accountCreatedAt && <ReadOnlyField label="Fecha de creación de cuenta" value={account.accountCreatedAt} />}
        {account.notes && <ReadOnlyField label="Notas Adicionales" value={account.notes} isMultiline />}
      </div>
    )
  }

  // MODO EDICIÓN (EDIT MODE)
  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-40 select-none font-sans animate-vault-morph lg:pb-36">
      <section className="space-y-5 rounded-2xl border border-black/[0.08] bg-gradient-to-b from-white to-slate-50/80 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] backdrop-blur">
        <div className="flex flex-col border-b border-border-subtle pb-3">
          <h3 className="text-sm font-bold text-text-primary">Credenciales Principales</h3>
          <p className="text-[10px] font-medium text-text-tertiary">Plataforma, usuario, contraseña y vías de acceso.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Combobox
            label="Plataforma"
            value={account.name}
            options={PLATFORM_OPTIONS}
            onChange={(value) => updateField('name', value)}
            placeholder="Amazon, GitHub, Stripe..."
          />
          <FormField
            label="Usuario"
            value={account.username}
            onChange={(e) => updateField('username', e.target.value)}
            placeholder="usuario o correo de login"
            autoComplete="off"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.75fr)]">
          <div className="space-y-3 rounded-2xl border border-black/[0.05] bg-white/70 p-4">
            <label className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-[15px] font-semibold text-text-primary transition-colors hover:bg-white/70">
              <input
                type="checkbox"
                className={checkboxClassName}
                checked={Boolean(passwordMethod)}
                onChange={(event) => togglePassword(event.target.checked)}
              />
              Contraseña
            </label>
            <div className={`grid transition-all duration-200 ${passwordMethod ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
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
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-black/[0.05] bg-white/70 p-4">
            <label className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-[15px] font-semibold text-text-primary transition-colors hover:bg-white/70">
              <input
                type="checkbox"
                className={checkboxClassName}
                checked={Boolean(ssoMethod)}
                onChange={(event) => toggleSso(event.target.checked)}
              />
              Login Social (SSO)
            </label>
            <div className={`grid transition-all duration-200 ${ssoMethod ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="space-y-3 overflow-visible">
                {ssoMethod && (
                  <>
                    <Combobox
                      label="Proveedor SSO"
                      value={ssoMethod.provider}
                      options={SSO_OPTIONS}
                      onChange={updateSsoProvider}
                      placeholder="Discord, Okta, LinkedIn..."
                      createLabel={(input) => `¿No encuentras tu proveedor? Crear "${input}"`}
                    />
                    <FormField
                      label="Correo usado en este SSO"
                      type="email"
                      value={ssoMethod.email ?? ''}
                      onChange={(event) => updateSsoEmail(event.target.value)}
                      placeholder={identityEmail}
                      autoComplete="off"
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 rounded-2xl border border-black/[0.04] bg-surface/40 p-4">
          <label className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-[15px] font-semibold text-text-primary transition-colors hover:bg-white/70">
            <input
              type="checkbox"
              className={checkboxClassName}
              checked={account.hardwareKey}
              onChange={(event) => updateField('hardwareKey', event.target.checked)}
            />
            Llave física
          </label>
          <label className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-[15px] font-semibold text-text-primary transition-colors hover:bg-white/70">
            <input
              type="checkbox"
              className={checkboxClassName}
              checked={passkeyEnabled}
              onChange={(event) => togglePasskey(event.target.checked)}
            />
            Passkey / Biometría
          </label>
          <label className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-[15px] font-semibold text-text-primary transition-colors hover:bg-white/70">
            <input
              type="checkbox"
              className={checkboxClassName}
              checked={Boolean(magicLinkMethod)}
              onChange={(event) => toggleMagicLink(event.target.checked)}
            />
            Magic Link
          </label>
          {magicLinkMethod && (
            <div className="w-full animate-vault-morph sm:max-w-sm">
              <FormField label="Correo para magic link" type="email" value={magicLinkMethod.email ?? ''} onChange={(event) => updateMagicLinkEmail(event.target.value)} placeholder={identityEmail} autoComplete="off" />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_14px_45px_rgba(15,23,42,0.045)]">
        <Accordion title="Información de la Cuenta">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Nombre completo"
            value={account.fullName ?? ''}
            onChange={(e) => updateField('fullName', e.target.value.trim() || null)}
            placeholder="Nombre y apellidos usados"
            autoComplete="off"
          />
          <FormField
            label="Fecha de nacimiento"
            type="date"
            value={account.birthDate ?? ''}
            onChange={(e) => updateField('birthDate', e.target.value || null)}
            autoComplete="off"
          />
          <FormField
            label="Fecha de creación de la cuenta"
            type="date"
            value={account.accountCreatedAt ?? ''}
            onChange={(e) => updateField('accountCreatedAt', e.target.value || null)}
            autoComplete="off"
          />
          <FormField
            label="Teléfono vinculado"
            type="tel"
            value={account.linkedPhone ?? ''}
            onChange={(e) => updateField('linkedPhone', e.target.value.trim() || null)}
            placeholder="+34 600 000 000"
            autoComplete="off"
          />
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-text-secondary">2FA / Segundo factor</span>
            <select
              value={twoFactorConfig.type}
              onChange={(event) => updateTwoFactorType(event.target.value as TwoFactorType)}
              className="min-h-11 w-full rounded-xl border border-black/[0.06] bg-white/80 px-3 py-2.5 text-base text-text-primary shadow-[0_8px_24px_rgba(0,0,0,0.025)] outline-none transition-all duration-150 focus:border-black/15 focus:bg-white focus:ring-2 focus:ring-black/[0.035]"
            >
              {(['NONE', 'PIN', 'TOTP', 'SMS'] as TwoFactorType[]).map((type) => (
                <option key={type} value={type}>{TWO_FACTOR_LABELS[type]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className={`grid transition-all duration-200 ${twoFactorConfig.type === 'PIN' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            {twoFactorConfig.type === 'PIN' && (
              <FormField
                label="PIN"
                type="password"
                inputMode="numeric"
                value={twoFactorConfig.pin ?? ''}
                onChange={(e) => updateTwoFactorDetail('pin', e.target.value)}
                placeholder="PIN de seguridad"
                autoComplete="off"
              />
            )}
          </div>
        </div>
        <div className={`grid transition-all duration-200 ${twoFactorConfig.type === 'TOTP' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            {twoFactorConfig.type === 'TOTP' && (
              <FormField
                label="Seed / Secret Key"
                value={twoFactorConfig.secret ?? ''}
                onChange={(e) => updateTwoFactorDetail('secret', e.target.value)}
                placeholder="JBSWY3DPEHPK3PXP"
                autoComplete="off"
              />
            )}
          </div>
        </div>

        <FormTextarea
          label="Notas generales"
          value={account.notes ?? ''}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Notas libres, respuestas de recuperación, contexto operativo..."
        />
        </Accordion>
      </section>

      <section className="rounded-2xl border border-black/[0.08] bg-slate-50/80 p-5 shadow-[0_12px_38px_rgba(15,23,42,0.04)]">
        <Accordion title="Opciones Avanzadas / Desarrollador">
          <div className="space-y-6 pt-3 pb-1">
            <div className="space-y-3">
              <div className="flex flex-col border-b border-border-subtle pb-2">
                <h3 className="text-sm font-bold text-text-primary">Códigos de Recuperación</h3>
                <p className="text-[10px] font-medium text-text-tertiary">
                  Códigos de un solo uso para recuperar acceso si pierdes tu dispositivo 2FA.
                </p>
              </div>

              <div className="relative flex flex-col gap-2.5 rounded-2xl border border-red-100/50 bg-white/80 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-600">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Códigos de Emergencia
                  </div>

                  <div className="flex items-center gap-0.5 rounded-lg border border-black/5 bg-white p-0.5 shadow-sm">
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
                        <span className="select-none px-1 text-[9px] font-bold text-green-600 animate-fade-in">Copiado</span>
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
                  className="min-h-[96px] w-full resize-y rounded-xl border border-black/5 bg-white px-3 py-2.5 font-mono text-xs leading-relaxed text-text-primary outline-none transition-colors focus:border-red-200"
                  style={!recoveryCodesVisible ? ({ WebkitTextSecurity: 'disc' } as CSSProperties) : undefined}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <div className="flex flex-col">
                  <h3 className="text-sm font-bold text-text-primary">API Keys</h3>
                  <p className="text-[10px] font-medium text-text-tertiary">Claves de desarrollo cifradas localmente de extremo a extremo.</p>
                </div>
                <button
                  type="button"
                  onClick={addApiKey}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-text-primary shadow-subtle transition-all duration-150 hover:bg-surface-hover active:scale-95"
                >
                  <svg className="h-4 w-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Añadir clave
                </button>
              </div>

              {apiKeys.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-white/60 p-6 text-center">
                  <p className="text-xs text-text-tertiary">Sin claves API registradas en esta cuenta.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>
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

      <div className="fixed bottom-4 left-4 right-4 z-[60] flex items-center justify-between gap-3 rounded-2xl border border-black/[0.08] bg-white px-4 py-3 shadow-[0_22px_70px_rgba(15,23,42,0.18)] ring-1 ring-white/80 backdrop-blur-xl lg:left-[calc(20rem+2rem)] lg:right-8">
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

import { useState, useEffect, type FormEvent, type CSSProperties, type MouseEvent } from 'react'
import type { Account, ApiKeyEntry, CustomFieldEntry, SsoProvider, TwoFactorConfig, TwoFactorType, FileAttachment } from '../types'
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
import { useVault } from '../context/VaultContext'
import { useToast } from './ui/ToastProvider'

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
    <div className="flex flex-col gap-3 rounded-[24px] border border-black/[0.06] bg-gradient-to-b from-white to-slate-50/90 p-4 shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <span className="inline-flex rounded-full border border-black/5 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-text-tertiary">
            API Key
          </span>
          <input
            type="text"
            value={keyEntry.nombre}
            onChange={(e) => updateApiKey(keyEntry.id, 'nombre', e.target.value)}
            placeholder="Nombre visible"
            className="w-full border-b border-transparent bg-transparent pb-0.5 text-base font-bold text-text-primary outline-none placeholder:text-text-tertiary focus:border-border-subtle"
          />
          <input
            type="text"
            value={keyEntry.descripcion}
            onChange={(e) => updateApiKey(keyEntry.id, 'descripcion', e.target.value)}
            placeholder="Entorno, alcance o proyecto"
            className="w-full border-b border-transparent bg-transparent pb-0.5 text-base text-text-secondary outline-none placeholder:text-text-tertiary focus:border-border-subtle"
          />
        </div>
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

      <div className="relative flex items-center gap-2 rounded-2xl border border-black/[0.05] bg-white/90 px-3 py-3">
        <input
          type={visible ? 'text' : 'password'}
          value={keyEntry.valor}
          onChange={(e) => updateApiKey(keyEntry.id, 'valor', e.target.value)}
          placeholder="Clave secreta (ej. sk-...)"
          className="w-full bg-transparent pr-24 text-base font-mono text-text-primary outline-none"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="rounded-lg border border-black/5 bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary active:scale-95"
            aria-label={visible ? 'Ocultar' : 'Mostrar'}
          >
            {visible ? 'Ocultar' : 'Mostrar'}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!keyEntry.valor}
            className="rounded-lg border border-black/5 bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary active:scale-95 disabled:opacity-45"
            aria-label="Copiar"
          >
            {copied ? (
              <span className="select-none px-1 text-[10px] font-bold text-green-600 animate-fade-in">Copiado</span>
            ) : (
              'Copiar'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function AttachmentItem({
  attachment,
  updateAttachment,
  removeAttachment,
  downloadAttachment,
}: {
  attachment: FileAttachment
  updateAttachment: (id: string, field: 'name' | 'description', value: string) => void
  removeAttachment: (id: string) => void
  downloadAttachment: (attachment: FileAttachment) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-white/60 p-4 shadow-sm transition-all focus-within:border-border focus-within:bg-white focus-within:shadow-md hover:bg-white/90">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-text-primary">{attachment.fileName}</p>
            <p className="text-[10px] text-text-tertiary">{(attachment.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => downloadAttachment(attachment)} className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 transition-colors" title="Descargar">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          </button>
          <button type="button" onClick={() => removeAttachment(attachment.id)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 transition-colors" title="Eliminar">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <input
          type="text"
          value={attachment.name}
          onChange={(e) => updateAttachment(attachment.id, 'name', e.target.value)}
          placeholder="Nombre identificativo (ej. Llave AWS)"
          className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 text-xs font-semibold text-text-primary outline-none transition-colors focus:border-border"
        />
        <input
          type="text"
          value={attachment.description}
          onChange={(e) => updateAttachment(attachment.id, 'description', e.target.value)}
          placeholder="Descripción (opcional)"
          className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 text-xs text-text-primary outline-none transition-colors focus:border-border"
        />
      </div>
    </div>
  )
}

const CopyIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.646.049 1.288.11 1.927.184 1.102.124 1.99 1.003 1.99 2.122v6.228a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 18.75v-6.228c0-1.12.888-2.002 1.99-2.122A48.394 48.394 0 0112 3c.775 0 1.545.09 2.298.266" />
  </svg>
)

function ReadOnlyField({ label, value, isMultiline = false }: { label: string; value: string | null | undefined; isSecret?: boolean; isMultiline?: boolean }) {
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const { authorizeSensitiveAction } = useVault()
  const { showToast } = useToast()

  useEffect(() => {
    if (!revealed) return
    const timer = window.setTimeout(() => setRevealed(false), 2 * 60 * 1000)
    return () => window.clearTimeout(timer)
  }, [revealed])

  if (!value) return null

  const authenticate = async () => {
    try {
      await authorizeSensitiveAction()
      return true
    } catch (error) {
      showToast(getFriendlyErrorMessage(error, 'No se pudo verificar tu identidad.'), 'error')
      return false
    }
  }

  const handleReveal = async () => {
    if (revealed) {
      setRevealed(false)
      return
    }
    if (await authenticate()) setRevealed(true)
  }

  const handleCopy = async (event?: MouseEvent) => {
    event?.stopPropagation()
    if (!(await authenticate())) return
    const ok = await copyToClipboard(value)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } else {
      showToast('No se pudo acceder al portapapeles.', 'error')
    }
  }

  return (
    <div className="group relative flex flex-col gap-1.5 rounded-2xl border border-black/[0.03] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.015)] transition-all duration-300 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:border-black/10 hover:-translate-y-[1px]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</span>
        <div className="flex min-h-12 shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => void handleReveal()}
            className="inline-flex min-h-11 items-center rounded-xl border border-black/5 bg-surface px-4 text-xs font-bold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus:outline-none"
          >
            {revealed ? 'Ocultar' : 'Mostrar'}
          </button>
          <button
            type="button"
            onClick={(event) => void handleCopy(event)}
            className={'inline-flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 active:scale-90 ' + (copied ? 'border-green-100 bg-green-50 text-green-600' : 'border-black/5 bg-surface text-text-tertiary hover:bg-surface-hover hover:text-text-primary')}
            title="Autenticar y copiar"
          >
            {copied ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : <CopyIcon />}
          </button>
        </div>
      </div>
      {revealed ? (
        <div className={'mt-0.5 break-all font-mono text-base font-semibold text-text-primary leading-relaxed overflow-wrap-anywhere ' + (isMultiline ? 'whitespace-pre-wrap' : '')}>{value}</div>
      ) : (
        <div className="text-base font-semibold text-text-primary truncate tracking-widest font-mono">••••••••••••</div>
      )}
    </div>
  )
}

function SecuritySummaryCard({
  eyebrow,
  title,
  description,
  secret,
  actionLabel,
}: {
  eyebrow: string
  title: string
  description: string
  secret?: string | null
  actionLabel: string
}) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const { authorizeSensitiveAction } = useVault()
  const { showToast } = useToast()

  useEffect(() => {
    if (!revealed) return
    const timer = window.setTimeout(() => setRevealed(false), 2 * 60 * 1000)
    return () => window.clearTimeout(timer)
  }, [revealed])

  const authenticate = async () => {
    try {
      await authorizeSensitiveAction()
      return true
    } catch (error) {
      showToast(getFriendlyErrorMessage(error, 'No se pudo verificar tu identidad.'), 'error')
      return false
    }
  }

  const handleReveal = async () => {
    if (revealed) {
      setRevealed(false)
      return
    }
    if (await authenticate()) setRevealed(true)
  }

  const handleCopy = async () => {
    if (!secret || !(await authenticate())) return
    const ok = await copyToClipboard(secret)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } else {
      showToast('No se pudo acceder al portapapeles.', 'error')
    }
  }

  return (
    <div className="rounded-[22px] border border-black/[0.06] bg-gradient-to-b from-white to-slate-50/90 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">{eyebrow}</p>
          <h4 className="mt-1 truncate text-sm font-semibold text-text-primary">{title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">{description}</p>
        </div>
        <span className="rounded-full border border-black/5 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary">{actionLabel}</span>
      </div>
      {secret ? (
        <div className="mt-4 rounded-2xl border border-black/[0.05] bg-white/90 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="break-all whitespace-pre-wrap font-mono text-xs text-text-primary overflow-wrap-anywhere">{revealed ? secret : '••••••••••••••••'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void handleReveal()} className="rounded-xl border border-black/5 bg-surface px-3 py-2 text-[11px] font-semibold text-text-secondary hover:bg-surface-hover">
                {revealed ? 'Ocultar' : 'Mostrar'}
              </button>
              <button type="button" onClick={() => void handleCopy()} className="rounded-xl border border-black/5 bg-surface px-3 py-2 text-[11px] font-semibold text-text-secondary hover:bg-surface-hover">
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

const AUTHENTICATOR_APP_OPTIONS = [
  'Google Authenticator',
  'Authy',
  'Microsoft Authenticator',
  '1Password',
  'Bitwarden',
  'Duo Mobile',
].map((label) => ({ label }))

const checkboxClassName =
  'h-5 w-5 shrink-0 cursor-pointer rounded-md border border-black/15 bg-white accent-slate-950 shadow-sm transition-transform duration-150 checked:scale-105 focus:outline-none focus:ring-4 focus:ring-black/[0.06]'

const TWO_FACTOR_LABELS: Record<TwoFactorType, string> = {
  NONE: 'Ninguno',
  PIN: 'PIN',
  TOTP: 'App Authenticator (TOTP)',
  SMS: 'SMS',
}

function getTwoFactorConfig(value: Account['twoFactorAuth']): TwoFactorConfig {
  if (!value) return { type: 'NONE', pin: null, secret: null, authenticatorApp: null }
  if (typeof value === 'string') return { type: 'TOTP', secret: value, pin: null, authenticatorApp: null }
  return {
    type: value.type,
    pin: value.pin ?? null,
    secret: value.secret ?? null,
    authenticatorApp: value.authenticatorApp ?? null,
  }
}

function twoFactorDisplay(value: Account['twoFactorAuth']): string | null {
  const config = getTwoFactorConfig(value)
  if (config.type === 'NONE') return null
  if (config.type === 'PIN') return config.pin ? `PIN: ${config.pin}` : 'PIN'
  if (config.type === 'TOTP') return config.authenticatorApp ? `${config.authenticatorApp} · Clave guardada` : 'App Authenticator'
  return 'SMS'
}

function passwordValue(account: Account): string {
  return account.accessMethods.find((method) => method.type === 'PASSWORD')?.password ?? ''
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
  const [passwordEnabled, setPasswordEnabled] = useState(() =>
    Boolean((initialAccount ?? createEmptyAccount()).accessMethods.some((method) => method.type === 'PASSWORD')),
  )

  const [recoveryCodesVisible, setRecoveryCodesVisible] = useState(false)
  const [recoveryCodesCopied, setRecoveryCodesCopied] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const downloadAttachment = (attachment: FileAttachment) => {
    try {
      const parts = attachment.data.split(';base64,')
      const base64Data = parts.length > 1 ? parts[1] : parts[0]
      const binaryString = window.atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: attachment.mimeType || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError('Error al descargar el archivo: Formato inválido.')
    }
  }

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
      setPasswordEnabled(baselineAccount.accessMethods.some((method) => method.type === 'PASSWORD'))
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
        twoFactorAuth: { type: 'NONE', pin: null, secret: null, authenticatorApp: null },
        notes: undefined,
        apiKeys: [],
        recoveryCodes: undefined,
        customFields: [],
        passwordHistory: [],
        sensitive: false,
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

  const addCustomField = () => {
    setAccount((prev) => ({
      ...prev,
      customFields: [
        ...(prev.customFields ?? []),
        { id: crypto.randomUUID(), key: '', value: '', protected: false },
      ],
    }))
  }

  const updateCustomField = <K extends keyof CustomFieldEntry>(id: string, key: K, value: CustomFieldEntry[K]) => {
    setAccount((prev) => ({
      ...prev,
      customFields: (prev.customFields ?? []).map((field) =>
        field.id === id ? { ...field, [key]: value } : field,
      ),
    }))
  }

  const removeCustomField = (id: string) => {
    setAccount((prev) => ({
      ...prev,
      customFields: (prev.customFields ?? []).filter((field) => field.id !== id),
    }))
  }

  const addAttachmentFromFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setError(`El archivo ${file.name} es demasiado grande. El límite es 10MB.`)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const data = e.target?.result as string
      setAccount((prev) => ({
        ...prev,
        attachments: [
          ...(prev.attachments ?? []),
          {
            id: crypto.randomUUID(),
            name: file.name.split('.')[0],
            description: '',
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            data,
            createdAt: new Date().toISOString()
          }
        ]
      }))
    }
    reader.onerror = () => {
      setError(`No se pudo leer el archivo ${file.name}.`)
    }
    reader.readAsDataURL(file)
  }

  const updateAttachment = (id: string, field: 'name' | 'description', value: string) => {
    setAccount((prev) => ({
      ...prev,
      attachments: (prev.attachments ?? []).map((att) =>
        att.id === id ? { ...att, [field]: value } : att,
      ),
    }))
  }

  const removeAttachment = (id: string) => {
    setAccount((prev) => ({
      ...prev,
      attachments: (prev.attachments ?? []).filter((att) => att.id !== id),
    }))
  }

  const accountForPersistence = (value: Account): Account => ({
    ...value,
    accessMethods: passwordEnabled
      ? value.accessMethods
      : value.accessMethods.filter((method) => method.type !== 'PASSWORD'),
  })

  const saveCurrentAccount = async () => {
    setError(null)

    const previousPassword = passwordValue(baselineAccount)
    const nextPassword = passwordValue(account)
    const shouldArchivePassword =
      mode === 'edit' &&
      passwordEnabled &&
      previousPassword &&
      nextPassword &&
      previousPassword !== nextPassword

    const accountWithHistory: Account = shouldArchivePassword
      ? {
          ...account,
          passwordHistory: [
            ...(account.passwordHistory ?? []),
            {
              id: crypto.randomUUID(),
              password: previousPassword,
              changedAt: new Date().toISOString(),
            },
          ].slice(-10),
        }
      : account

    const normalized = normalizeAccount(accountForPersistence(accountWithHistory))
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
      setPasswordEnabled(normalized.accessMethods.some((method) => method.type === 'PASSWORD'))
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

  const isDirty =
    isEditing &&
    JSON.stringify(normalizeAccount(accountForPersistence(account))) !== JSON.stringify(normalizeAccount(baselineAccount))

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
    setPasswordEnabled(enabled)
    if (!enabled || passwordMethod) return
    setAccessMethods((methods) => [...methods, { id: crypto.randomUUID(), type: 'PASSWORD', password: '' }])
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
        return [...filtered, { id: crypto.randomUUID(), type: 'SSO', providers: ['Google'], email: identityEmail }]
      }
      return filtered
    })
  }

  const toggleSsoProvider = (provider: SsoProvider, checked: boolean) => {
    setAccessMethods((methods) => methods.map((m) => {
      if (m.type === 'SSO') {
        const nextProviders = checked
          ? [...new Set([...m.providers, provider])]
          : m.providers.filter(p => p !== provider)
        return { ...m, providers: nextProviders.length > 0 ? nextProviders : ['Google'] }
      }
      return m
    }))
  }

  const updateTwoFactorType = (type: TwoFactorType) => {
    const current = getTwoFactorConfig(account.twoFactorAuth)
    updateField(
      'twoFactorAuth',
      type === 'NONE'
        ? { ...current, type: 'NONE' }
        : { ...current, type },
    )
  }

  const updateTwoFactorDetail = (field: 'pin' | 'secret' | 'authenticatorApp', value: string) => {
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
      <div className="w-full font-sans animate-vault-morph">
        {/* Sticky Header — Vista Lectura */}
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border-subtle bg-white/90 px-4 py-3 backdrop-blur-xl lg:px-8 lg:py-4">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={onCancel} className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover" aria-label="Volver">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <PlatformLogo name={account.name} className="h-8 w-8 shrink-0 rounded-xl" />
            <h2 className="truncate text-lg font-bold tracking-tight text-text-primary">{account.name}</h2>
          </div>
          <button type="button" onClick={() => setIsEditing(true)} className="shrink-0 rounded-xl bg-text-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95">
            Editar
          </button>
        </header>

        <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 lg:px-8">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadOnlyField label="Usuario" value={account.username} />
          {passwordMethod && <ReadOnlyField label="Contraseña" value={passwordMethod.password} isSecret />}
          {account.linkedPhone && <ReadOnlyField label="Teléfono vinculado" value={account.linkedPhone} />}
          {ssoMethod && <ReadOnlyField label={`Login con ${ssoMethod.providers.join(', ')}`} value={ssoMethod.email || identityEmail} />}
          {passkeyEnabled && <ReadOnlyField label="Biometría / Passkey" value="Activado" />}
          {magicLinkMethod && <ReadOnlyField label="Magic Link" value={magicLinkMethod.email || identityEmail} />}
          {account.hardwareKey && <ReadOnlyField label="Llave Física (YubiKey)" value="Activada" />}
        </div>

        {(twoFactorDisplay(account.twoFactorAuth) || apiKeys.length > 0) && (
          <div className="space-y-3 pt-2">
            <div className="px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Seguridad avanzada</h3>
              <p className="mt-1 text-xs text-text-secondary">Los factores extra y secretos técnicos se presentan como activos protegidos, más claros y más fáciles de revisar.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {twoFactorDisplay(account.twoFactorAuth) && (
                <SecuritySummaryCard
                  eyebrow="2FA"
                  title={twoFactorConfig.type === 'TOTP' ? (twoFactorConfig.authenticatorApp || 'Authenticator configurado') : twoFactorDisplay(account.twoFactorAuth) || 'Segundo factor'}
                  description={
                    twoFactorConfig.type === 'TOTP'
                      ? 'La app de autenticación y su clave manual quedan agrupadas en una ficha segura y legible.'
                      : twoFactorConfig.type === 'SMS'
                        ? 'El segundo factor depende del teléfono vinculado a esta cuenta.'
                        : 'Protección adicional guardada junto a la plataforma.'
                  }
                  secret={twoFactorConfig.type === 'TOTP' ? twoFactorConfig.secret : twoFactorConfig.type === 'PIN' ? twoFactorConfig.pin : null}
                  actionLabel={twoFactorConfig.type === 'TOTP' ? 'Authenticator' : 'Protegido'}
                />
              )}
              {apiKeys.length > 0 && (
                <div className="space-y-3 rounded-[24px] border border-black/[0.06] bg-gradient-to-b from-white to-slate-50/90 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">API Keys</p>
                      <h4 className="mt-1 text-sm font-semibold text-text-primary">Credenciales técnicas cifradas</h4>
                      <p className="mt-1 text-xs leading-relaxed text-text-secondary">Cada clave queda descrita y protegida como un secreto independiente para no perder contexto.</p>
                    </div>
                    <span className="rounded-full border border-black/5 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary">
                      {apiKeys.length} activas
                    </span>
                  </div>
                  <div className="space-y-3">
                    {apiKeys.map((key) => (
                      <SecuritySummaryCard
                        key={key.id}
                        eyebrow="API"
                        title={key.nombre || 'Clave sin nombre'}
                        description={key.descripcion || 'Sin descripción añadida todavía.'}
                        secret={key.valor}
                        actionLabel="Secreta"
                      />
                    ))}
                  </div>
                </div>
              )}
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
        {(account.customFields ?? []).map((field) => (
          <ReadOnlyField
            key={field.id}
            label={field.key || 'Campo personalizado'}
            value={field.value}
            isSecret={field.protected}
          />
        ))}
        </div>
      </div>
    )
  }

  // MODO EDICIÓN (EDIT MODE)
  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col select-none font-sans animate-vault-morph">
      {/* Sticky Header — Modo Edición */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border-subtle bg-white/90 px-4 py-3 backdrop-blur-xl lg:px-8 lg:py-4">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={handleCancelEdit} className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover" aria-label="Volver">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <PlatformLogo name={account.name} className="h-8 w-8 shrink-0 rounded-xl" />
          <h2 className="truncate text-lg font-bold text-text-primary">
            {mode === 'create' ? 'Nueva plataforma' : (account.name || 'Editar plataforma')}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {mode === 'edit' && onDelete && (
            <button type="button" onClick={() => setShowDeleteModal(true)} className="rounded-xl px-4 py-2 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 active:scale-95">
              Eliminar
            </button>
          )}
          <button type="submit" disabled={saving} className="rounded-xl bg-text-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 active:scale-95">
            {saving ? 'Guardando…' : mode === 'create' ? 'Crear cuenta' : 'Guardar'}
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 lg:px-8">
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

        {/* Contraseña Principal */}
        <div className="space-y-3 rounded-2xl border border-black/[0.05] bg-white/70 p-4">
          <label className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-[15px] font-semibold text-text-primary transition-colors hover:bg-white/70">
            <input
              type="checkbox"
              className={checkboxClassName}
              checked={passwordEnabled}
              onChange={(event) => togglePassword(event.target.checked)}
            />
            Contraseña Tradicional
          </label>
          <div className={`grid transition-all duration-200 ${passwordEnabled && passwordMethod ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden space-y-3">
              {passwordEnabled && passwordMethod && (
                <>
                  <PasswordField
                    label="Contraseña"
                    value={passwordMethod.password}
                    onChange={updatePasswordMethod}
                    placeholder="••••••••"
                    required
                    showGenerator
                  />
                  {(account.passwordHistory ?? []).length > 0 && (
                    <Accordion title="Historial de contraseñas">
                      <div className="space-y-2 mt-2">
                        {[...(account.passwordHistory ?? [])].reverse().map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.05] bg-white p-3">
                            <div className="min-w-0">
                              <p className="truncate font-mono text-xs font-semibold text-text-primary">••••••••••••</p>
                              <p className="mt-0.5 text-[10px] font-medium text-text-tertiary">{new Date(entry.changedAt).toLocaleString()}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void copyToClipboard(entry.password)}
                              className="rounded-lg border border-black/5 bg-surface px-3 py-2 text-xs font-bold text-text-primary transition-colors hover:bg-surface-hover"
                            >
                              Copiar antigua
                            </button>
                          </div>
                        ))}
                      </div>
                    </Accordion>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Otros métodos de inicio de sesión (SSO, Passkey, Magic Link) */}
        <Accordion title="Otros métodos de inicio de sesión" defaultOpen={Boolean(ssoMethod || passkeyEnabled || magicLinkMethod)}>
          <div className="grid gap-4 mt-2 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.75fr)]">
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
                      <div className="flex flex-wrap gap-2">
                        {ssoMethod.providers.map(p => (
                          <div key={p} className="flex items-center gap-1 rounded-lg border bg-surface px-2 py-1 text-sm text-text-primary">
                            {p}
                            <button type="button" onClick={() => toggleSsoProvider(p, false)} className="text-text-tertiary hover:text-red-500 font-bold">&times;</button>
                          </div>
                        ))}
                      </div>
                      <Combobox
                        label="Añadir Proveedor SSO"
                        value=""
                        options={SSO_OPTIONS.filter(o => !ssoMethod.providers.includes(o.label))}
                        onChange={(val) => toggleSsoProvider(val, true)}
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

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 rounded-2xl border border-black/[0.04] bg-surface/40 p-4">
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
                  <div className="w-full animate-vault-morph px-2 pb-2">
                    <FormField label="Correo para magic link" type="email" value={magicLinkMethod.email ?? ''} onChange={(event) => updateMagicLinkEmail(event.target.value)} placeholder={identityEmail} autoComplete="off" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </Accordion>

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
              checked={Boolean(account.sensitive)}
              onChange={(event) => updateField('sensitive', event.target.checked)}
            />
            Sensible / ocultar en Modo Viaje
          </label>
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
          {account.accountCreatedAt ? (
            <div className="space-y-2">
              <FormField
                label="Fecha de creación de la cuenta"
                type="date"
                value={account.accountCreatedAt}
                onChange={(e) => updateField('accountCreatedAt', e.target.value || null)}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => updateField('accountCreatedAt', null)}
                className="text-xs font-semibold text-text-tertiary transition-colors hover:text-text-primary"
              >
                Quitar fecha
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-black/[0.08] bg-surface/60 p-4">
              <p className="text-sm font-semibold text-text-primary">Fecha de creación de la cuenta</p>
              <p className="mt-1 text-xs leading-relaxed text-text-tertiary">Opcional. Úsala solo si quieres registrar cuándo creaste esta cuenta en la vida real.</p>
              <button
                type="button"
                onClick={() => updateField('accountCreatedAt', new Date().toISOString().slice(0, 10))}
                className="mt-3 rounded-xl border border-black/5 bg-white px-3 py-2 text-xs font-bold text-text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-surface-hover"
              >
                Añadir fecha
              </button>
            </div>
          )}
          <FormField
            label="Teléfono vinculado"
            type="tel"
            value={account.linkedPhone ?? ''}
            onChange={(e) => updateField('linkedPhone', e.target.value.trim() || null)}
            placeholder="+34 600 000 000"
            autoComplete="off"
          />
          <div className="rounded-[22px] border border-black/[0.06] bg-gradient-to-b from-white to-slate-50/85 p-4 sm:col-span-2">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="block text-sm font-semibold text-text-secondary">2FA / Segundo factor</span>
                <p className="mt-1 text-xs leading-relaxed text-text-tertiary">Agrupa aquí tu app de autenticación, PIN o SMS de respaldo con una presentación más limpia y profesional.</p>
              </div>
              <span className="inline-flex w-fit rounded-full border border-black/5 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary">
                {TWO_FACTOR_LABELS[twoFactorConfig.type]}
              </span>
            </div>
            <select
              value={twoFactorConfig.type}
              onChange={(event) => updateTwoFactorType(event.target.value as TwoFactorType)}
              className="min-h-11 w-full rounded-xl border border-black/[0.06] bg-white/90 px-3 py-2.5 text-base text-text-primary shadow-[0_8px_24px_rgba(0,0,0,0.025)] outline-none transition-all duration-150 focus:border-black/15 focus:bg-white focus:ring-2 focus:ring-black/[0.035]"
            >
              {(['NONE', 'PIN', 'TOTP', 'SMS'] as TwoFactorType[]).map((type) => (
                <option key={type} value={type}>{TWO_FACTOR_LABELS[type]}</option>
              ))}
            </select>
          </div>
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
              <div className="mt-4 rounded-[22px] border border-emerald-100 bg-emerald-50/70 p-4">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Authenticator configurado con respaldo manual</p>
                    <p className="mt-1 text-xs leading-relaxed text-text-secondary">Guarda la app que usas y la clave larga que entrega la web para poder restaurar el 2FA sin depender solo del QR.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Combobox
                  label="¿Qué app de autenticación usas?"
                  value={twoFactorConfig.authenticatorApp ?? ''}
                  options={AUTHENTICATOR_APP_OPTIONS}
                  onChange={(value) => updateTwoFactorDetail('authenticatorApp', value)}
                  placeholder="Google Authenticator, Authy..."
                  createLabel={(input) => `Usar "${input}"`}
                />
                <div>
                  <FormField
                    label="Clave de configuración"
                    value={twoFactorConfig.secret ?? ''}
                    onChange={(e) => updateTwoFactorDetail('secret', e.target.value)}
                    placeholder="Texto largo proporcionado por la web"
                    autoComplete="off"
                  />
                  <p className="mt-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-medium leading-relaxed text-blue-900">
                    La web suele mostrarla al configurar 2FA, cerca del QR. Si solo ves un QR, busca la opción “introducir clave manualmente”.
                  </p>
                </div>
              </div>
              </div>
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
        <Accordion title="Datos técnicos y seguridad">
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
                  <h3 className="text-sm font-bold text-text-primary">Campos personalizados</h3>
                  <p className="text-[10px] font-medium text-text-tertiary">Pares clave/valor ilimitados para PINs, respuestas de seguridad o datos específicos.</p>
                </div>
                <button
                  type="button"
                  onClick={addCustomField}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-text-primary shadow-subtle transition-all duration-150 hover:bg-surface-hover active:scale-95"
                >
                  <svg className="h-4 w-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Añadir campo
                </button>
              </div>

              {(account.customFields ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-white/60 p-6 text-center">
                  <p className="text-xs text-text-tertiary">Sin campos personalizados todavía.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(account.customFields ?? []).map((field) => (
                    <div key={field.id} className="rounded-2xl border border-black/[0.05] bg-white p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        <input
                          value={field.key}
                          onChange={(event) => updateCustomField(field.id, 'key', event.target.value)}
                          placeholder="Clave"
                          className="min-w-0 flex-1 border-b border-transparent bg-transparent pb-1 text-base font-bold text-text-primary outline-none placeholder:text-text-tertiary focus:border-border-subtle"
                        />
                        <button
                          type="button"
                          onClick={() => removeCustomField(field.id)}
                          className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label="Eliminar campo personalizado"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <textarea
                        value={field.value}
                        onChange={(event) => updateCustomField(field.id, 'value', event.target.value)}
                        placeholder="Valor"
                        className="mt-2 min-h-20 w-full resize-y rounded-xl border border-black/5 bg-surface px-3 py-2 text-base text-text-primary outline-none focus:border-border"
                        style={field.protected ? ({ WebkitTextSecurity: 'disc' } as CSSProperties) : undefined}
                      />
                      <label className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-text-secondary">
                        <input
                          type="checkbox"
                          className={checkboxClassName}
                          checked={Boolean(field.protected)}
                          onChange={(event) => updateCustomField(field.id, 'protected', event.target.checked)}
                        />
                        Ocultar valor en lectura
                      </label>
                    </div>
                  ))}
                </div>
              )}
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

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <div className="flex flex-col">
                  <h3 className="text-sm font-bold text-text-primary">Archivos Adjuntos</h3>
                  <p className="text-[10px] font-medium text-text-tertiary">Documentos, JSONs o llaves PEM almacenados en la bóveda cifrada.</p>
                </div>
              </div>

              <div
                className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${isDragging ? 'border-blue-400 bg-blue-50/50' : 'border-border bg-surface-elevated hover:bg-surface-hover'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    addAttachmentFromFile(e.dataTransfer.files[0])
                  }
                }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-text-tertiary shadow-sm">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-primary">Arrastra un archivo aquí o haz clic para subir</p>
                  <p className="mt-1 text-[10px] text-text-tertiary">Límite recomendado: 10MB</p>
                </div>
                <input
                  type="file"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      addAttachmentFromFile(e.target.files[0])
                      e.target.value = ''
                    }
                  }}
                />
              </div>

              {(account.attachments ?? []).length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
                  {(account.attachments ?? []).map((att) => (
                    <AttachmentItem
                      key={att.id}
                      attachment={att}
                      updateAttachment={updateAttachment}
                      removeAttachment={removeAttachment}
                      downloadAttachment={downloadAttachment}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </Accordion>
      </section>

      <section className="mb-24">
        <Accordion title="Danger Zone (Sincronización Selectiva)" defaultOpen={Boolean(account.isLocalOnly)}>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-900">Desactivar Sincronización en la Nube (Device-Only)</h3>
                <p className="mt-1 text-xs leading-relaxed text-red-800/80">
                  Si activas esta opción, esta cuenta <strong>nunca se subirá a la nube</strong> y solo existirá en este dispositivo.
                  Si desinstalas la aplicación o formateas el dispositivo, perderás esta contraseña para siempre. Útil para credenciales ultra-secretas.
                </p>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-red-100">
                  <span className="text-sm font-semibold text-red-900">Modo Solo-Dispositivo</span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={Boolean(account.isLocalOnly)}
                      onChange={(e) => setAccount({ ...account, isLocalOnly: e.target.checked })}
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-red-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-red-300"></div>
                  </label>
                </div>
              </div>
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

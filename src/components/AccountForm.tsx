import { useState, useEffect, useCallback, useRef, type FormEvent, type CSSProperties, type MouseEvent } from 'react'
import type { Account, ApiKeyEntry, CustomFieldEntry, SsoProvider, TwoFactorConfig, TwoFactorType } from '../types'
import { createEmptyAccount } from '../utils/account'
import { createApiKeyEntry, normalizeAccount } from '../utils/normalizeAccount'
import { generateId } from '../utils/id'
import { Accordion } from './ui/Accordion'
import { FormField, FormTextarea } from './ui/FormField'
import { PasswordField } from './ui/PasswordField'
import { copyToClipboard } from '../utils/clipboard'
import { getFriendlyErrorMessage } from '../utils/errors'
import { hasWeakPassword, evaluatePassword } from '../utils/security'
import { PlatformLogo } from './ui/PlatformLogo'
import { Combobox } from './ui/Combobox'
import { POPULAR_SERVICES } from '../data/popularServices'
import { useVault } from '../context/VaultContext'
import { useToast } from './ui/ToastProvider'
import { AttachmentsList } from './ui/AttachmentsList'
import { TagsInput } from './ui/TagsInput'

interface AccountFormProps {
  mode: 'create' | 'edit'
  identityEmail: string
  initialAccount?: Account
  onSave: (account: Account, targetIdentityId?: string) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
  onShare?: () => void
  onUnsavedStateChange?: (dirty: boolean, actions: UnsavedFormActions | null) => void
  onRequestNavigation?: (action: () => void) => void
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

const CopyIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.646.049 1.288.11 1.927.184 1.102.124 1.99 1.003 1.99 2.122v6.228a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 18.75v-6.228c0-1.12.888-2.002 1.99-2.122A48.394 48.394 0 0112 3c.775 0 1.545.09 2.298.266" />
  </svg>
)

function ReadOnlyField({ label, value, isSecret = false, isMultiline = false, onAccess, autoReveal }: { label: string; value: string | null | undefined; isSecret?: boolean; isMultiline?: boolean; onAccess?: () => void; autoReveal?: boolean }) {
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(autoReveal || false)
  const [authenticating, setAuthenticating] = useState(false)
  const { authorizeSensitiveAction } = useVault()
  const { showToast } = useToast()

  useEffect(() => {
    if (autoReveal) setRevealed(true)
  }, [autoReveal])

  useEffect(() => {
    if (!revealed || autoReveal) return
    const timer = window.setTimeout(() => setRevealed(false), 2 * 60 * 1000)
    return () => window.clearTimeout(timer)
  }, [revealed, autoReveal])

  if (!value) return null

  const authenticate = async () => {
    return await authorizeSensitiveAction()
  }

  const handleReveal = async () => {
    if (authenticating) return
    if (revealed) {
      setRevealed(false)
      return
    }
    setAuthenticating(true)
    try {
      if (await authenticate()) {
        setRevealed(true)
        onAccess?.()
      }
    } catch (error) {
      showToast(getFriendlyErrorMessage(error, 'No se pudo verificar tu identidad.'), 'error')
    } finally {
      setAuthenticating(false)
    }
  }

  const handleCopy = async (event?: MouseEvent) => {
    event?.stopPropagation()
    try {
      if (isSecret && !(await authenticate())) return
    } catch (error) {
      showToast(getFriendlyErrorMessage(error, 'No se pudo verificar tu identidad.'), 'error')
      return
    }
    if (isSecret) onAccess?.()
    const ok = await copyToClipboard(value)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } else {
      showToast('No se pudo acceder al portapapeles.', 'error')
    }
  }

  return (
    <div className="group relative flex flex-col gap-1.5 rounded-2xl border border-black/[0.03] dark:border-white/5 bg-white dark:bg-[#1c1c1e] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.015)] transition-all duration-300 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:border-black/10 dark:hover:border-white/10 hover:-translate-y-[1px]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</span>
        <div className="flex min-h-12 shrink-0 items-center gap-3">
          {isSecret && (
            <button
              type="button"
              onClick={() => void handleReveal()}
              disabled={authenticating}
              className="inline-flex min-h-11 items-center rounded-xl border border-black/5 dark:border-white/5 bg-surface dark:bg-slate-800 px-4 text-xs font-bold text-text-secondary transition-colors hover:bg-surface-hover dark:hover:bg-slate-700 hover:text-text-primary focus:outline-none disabled:cursor-wait disabled:opacity-60"
            >
              {authenticating ? 'Verificando...' : revealed ? 'Ocultar' : 'Mostrar'}
            </button>
          )}
          <button
            type="button"
            onClick={(event) => void handleCopy(event)}
            className={'inline-flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 active:scale-90 ' + (copied ? 'border-green-100 bg-green-50 text-green-600 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400' : 'border-black/5 bg-surface dark:border-white/5 dark:bg-slate-800 text-text-tertiary hover:bg-surface-hover dark:hover:bg-slate-700 hover:text-text-primary')}
            title="Copiar"
          >
            {copied ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : <CopyIcon />}
          </button>
        </div>
      </div>
      {(!isSecret || revealed) ? (
        <div className={'mt-0.5 break-all font-mono text-base font-semibold text-text-primary leading-relaxed overflow-wrap-anywhere ' + (isMultiline ? 'whitespace-pre-wrap' : '')}>{value}</div>
      ) : (
        <div className="text-base font-semibold text-text-primary truncate tracking-widest font-mono">••••••••••••</div>
      )}
    </div>
  )
}

import { TotpDisplay } from './TotpDisplay'

function SecuritySummaryCard({
  eyebrow,
  title,
  description,
  secret,
  actionLabel,
  isTotp,
  onAccess,
  autoReveal,
}: {
  eyebrow: string
  title: string
  description: string
  secret?: string | null
  actionLabel: string
  isTotp?: boolean
  onAccess?: () => void
  autoReveal?: boolean
}) {
  const [revealed, setRevealed] = useState(autoReveal || false)
  const [copied, setCopied] = useState(false)
  const [authenticating, setAuthenticating] = useState(false)
  const { authorizeSensitiveAction } = useVault()
  const { showToast } = useToast()

  useEffect(() => {
    if (autoReveal) setRevealed(true)
  }, [autoReveal])

  useEffect(() => {
    if (!revealed || autoReveal) return
    const timer = window.setTimeout(() => setRevealed(false), 2 * 60 * 1000)
    return () => window.clearTimeout(timer)
  }, [revealed, autoReveal])

  const authenticate = async () => {
    return await authorizeSensitiveAction()
  }

  const handleReveal = async () => {
    if (authenticating) return
    if (revealed) {
      setRevealed(false)
      return
    }
    setAuthenticating(true)
    try {
      if (await authenticate()) {
        setRevealed(true)
        onAccess?.()
      }
    } catch (error) {
      showToast(getFriendlyErrorMessage(error, 'No se pudo verificar tu identidad.'), 'error')
    } finally {
      setAuthenticating(false)
    }
  }

  const handleCopy = async (event?: MouseEvent) => {
    event?.stopPropagation()
    if (!secret) return
    try {
      if (!revealed && !(await authenticate())) return
    } catch (error) {
      showToast(getFriendlyErrorMessage(error, 'No se pudo verificar tu identidad.'), 'error')
      return
    }
    if (!revealed) onAccess?.()
    const ok = await copyToClipboard(secret)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } else {
      showToast('No se pudo acceder al portapapeles.', 'error')
    }
  }

  return (
    <div className="group flex flex-col rounded-2xl border border-black/[0.03] dark:border-white/5 bg-white dark:bg-[#1c1c1e] shadow-[0_2px_8px_rgba(0,0,0,0.015)] transition-all duration-300 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:border-black/10 dark:hover:border-white/10 hover:-translate-y-[1px]">
      <div className="flex p-4">
        <div className="flex-1 min-w-0 pr-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{eyebrow}</span>
          <h4 className="mt-1 text-sm font-bold text-text-primary truncate">{title}</h4>
          <p className="mt-1 text-xs text-text-secondary leading-relaxed line-clamp-2">{description}</p>
        </div>
        <div className="flex flex-col items-end justify-center shrink-0 border-l border-border-subtle pl-4 gap-2">
          {secret && !isTotp && (
            <button
              type="button"
              onClick={(event) => void handleCopy(event)}
              className={'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all active:scale-95 ' + (copied ? 'border-green-100 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400' : 'border-black/5 bg-surface dark:border-white/5 dark:bg-slate-800 text-text-secondary hover:bg-surface-hover dark:hover:bg-slate-700 hover:text-text-primary')}
            >
              {copied ? <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
              Copiar {actionLabel}
            </button>
          )}
          {secret && (
            <button
              type="button"
              onClick={() => void handleReveal()}
              disabled={authenticating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-text-secondary transition-colors hover:bg-surface-hover dark:hover:bg-slate-700 hover:text-text-primary disabled:opacity-50 border border-black/5 dark:border-white/5"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {revealed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                )}
              </svg>
              {revealed ? 'Ocultar' : 'Mostrar'}
            </button>
          )}
        </div>
      </div>
      {secret && (revealed || isTotp) && (
        <div className={`border-t border-border-subtle bg-slate-50/50 p-4 transition-all ${!revealed && isTotp ? 'opacity-90 blur-sm select-none' : ''}`}>
          {isTotp ? (
            <TotpDisplay secret={secret} onCopy={() => setCopied(true)} />
          ) : (
            <div className="break-all font-mono text-[13px] font-semibold text-text-primary leading-relaxed bg-white p-3 rounded-xl border border-black/5 shadow-sm">
              {secret}
            </div>
          )}
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

function getTwoFactorConfig(value: Account['twoFactorAuth']): TwoFactorConfig {
  if (!value) return { id: 'legacy', type: 'NONE', pin: null, secret: null, authenticatorApp: null, phone: null }
  if (typeof value === 'string') return { id: 'legacy', type: 'TOTP', secret: value, pin: null, authenticatorApp: null, phone: null }
  return {
    id: value.id || 'legacy',
    type: value.type,
    pin: value.pin ?? null,
    secret: value.secret ?? null,
    authenticatorApp: value.authenticatorApp ?? null,
    phone: value.phone ?? null,
  }
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
  onShare,
  onUnsavedStateChange,
  onRequestNavigation,
}: AccountFormProps) {
  const [account, setAccount] = useState<Account>(() => initialAccount ?? createEmptyAccount())
  const [baselineAccount, setBaselineAccount] = useState<Account>(() => initialAccount ?? createEmptyAccount())
  const [saving, setSaving] = useState(false)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [isEditing, setIsEditing] = useState(mode === 'create')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [passwordEnabled, setPasswordEnabled] = useState(() =>
    Boolean((initialAccount ?? createEmptyAccount()).accessMethods.some((method) => method.type === 'PASSWORD')),
  )
  const { identities, addIdentity, authorizeSensitiveAction, trackItemAccess } = useVault()
  const { showToast } = useToast()
  const [targetIdentityId, setTargetIdentityId] = useState<string>(() => {
    const id = identities.find(i => i.email === identityEmail)?.id
    return id ?? (identities[0]?.id || '')
  })
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [showNewIdentityInput, setShowNewIdentityInput] = useState(false)
  const [newIdentityEmail, setNewIdentityEmail] = useState('')

  const [recoveryCodesVisible, setRecoveryCodesVisible] = useState(false)
  const [recoveryCodesCopied, setRecoveryCodesCopied] = useState(false)
  // const [isDragging, setIsDragging] = useState(false) // removed unused state
  const [ssoProviderQuery, setSsoProviderQuery] = useState('')
  const [platformQuery, setPlatformQuery] = useState(() => account.name)
  const accessTrackedRef = useRef(false)

  const [exposedCheckCount, setExposedCheckCount] = useState<number | null>(
    () => initialAccount?.exposedBreachCount ?? null
  )
  const [isCheckingExposed, setIsCheckingExposed] = useState(false)
  const initialPasswordRef = useRef(initialAccount ? passwordValue(initialAccount) : '')

  const passwordMethod = account.accessMethods.find((method) => method.type === 'PASSWORD')

  useEffect(() => {
    const password = passwordMethod?.password || ''
    if (!password) {
      setExposedCheckCount(null)
      setIsCheckingExposed(false)
      return
    }

    if (initialAccount && password === initialPasswordRef.current) {
      setExposedCheckCount(initialAccount.exposedBreachCount ?? null)
      setIsCheckingExposed(false)
      return
    }

    setIsCheckingExposed(true)
    const timer = setTimeout(async () => {
      try {
        const { checkPasswordBreach } = await import('../utils/security')
        const count = await checkPasswordBreach(password)
        setExposedCheckCount(count)
      } catch (e) {
        console.error('Error checking password leak dynamically:', e)
      } finally {
        setIsCheckingExposed(false)
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [passwordMethod?.password, initialAccount])

  useEffect(() => {
    setPlatformQuery(account.name)
  }, [account.name])

  useEffect(() => {
    if (mode === 'edit') {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [mode])

  const handleItemAccessed = useCallback(() => {
    if (account.id && targetIdentityId && !isEditing) {
      void trackItemAccess(account.id, targetIdentityId)
    }
  }, [account.id, targetIdentityId, isEditing, trackItemAccess])

  useEffect(() => {
    if (mode !== 'edit' || isEditing || accessTrackedRef.current || !account.id || !targetIdentityId) return
    accessTrackedRef.current = true
    void trackItemAccess(account.id, targetIdentityId)
  }, [account.id, isEditing, mode, targetIdentityId, trackItemAccess])

  const handleGlobalUnlock = async () => {
    if (isUnlocked) return
    const ok = await authorizeSensitiveAction('Desbloquear secretos')
    if (ok) {
      setIsUnlocked(true)
      showToast('Información sensible revelada', 'success')
      handleItemAccessed()
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
        else if (isEditing) handleCancelClick()
        else onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, showDeleteModal, account, baselineAccount, platformQuery])

  const handleCancelEdit = () => {
    onUnsavedStateChange?.(false, null)
    if (mode === 'create') {
      onCancel()
    } else {
      setAccount(baselineAccount)
      setPasswordEnabled(baselineAccount.accessMethods.some((method) => method.type === 'PASSWORD'))
      setIsEditing(false)
    }
  }

  const handleCancelClick = () => {
    const cancelAction = () => {
      onUnsavedStateChange?.(false, null)
      if (mode === 'create') {
        onCancel()
      } else {
        setAccount(baselineAccount)
        setPasswordEnabled(baselineAccount.accessMethods.some((method) => method.type === 'PASSWORD'))
        setIsEditing(false)
      }
    }

    if (isDirty && onRequestNavigation) {
      onRequestNavigation(cancelAction)
    } else {
      cancelAction()
    }
  }

  const handleCopyRecoveryCodes = async () => {
    handleItemAccessed()
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
        twoFactorAuth: null,
        notes: undefined,
        apiKeys: [],
        recoveryCodes: undefined,
        customFields: [],
        passwordHistory: [],
        sensitive: false,
        createdAt: '',
        updatedAt: '',
      })
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

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase()
    if (!trimmed) return
    setAccount((prev) => {
      const currentTags = prev.tags ?? []
      if (currentTags.includes(trimmed)) return prev
      return { ...prev, tags: [...currentTags, trimmed] }
    })
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setAccount((prev) => ({
      ...prev,
      tags: (prev.tags ?? []).filter((t) => t !== tagToRemove),
    }))
  }

  const addCustomField = useCallback(() => {
    setAccount((prev) => ({
      ...prev,
      customFields: [
        ...(prev.customFields || []),
        { id: generateId(), key: '', value: '', protected: false },
      ],
    }))
  }, [])

  const updateCustomField = useCallback(<K extends keyof CustomFieldEntry>(id: string, key: K, value: CustomFieldEntry[K]) => {
    setAccount((prev) => {
      const current = prev.customFields || []
      const index = current.findIndex((f) => f.id === id)
      if (index === -1) return prev
      if (current[index][key] === value) return prev // Avoid infinite loops if no actual change

      const nextFields = [...current]
      nextFields[index] = { ...nextFields[index], [key]: value }
      return { ...prev, customFields: nextFields }
    })
  }, [])

  const removeCustomField = useCallback((id: string) => {
    setAccount((prev) => ({
      ...prev,
      customFields: (prev.customFields || []).filter((field) => field.id !== id),
    }))
  }, [])


  const accountForPersistence = (value: Account): Account => ({
    ...value,
    accessMethods: passwordEnabled
      ? value.accessMethods
      : value.accessMethods.filter((method) => method.type !== 'PASSWORD'),
  })

  const saveCurrentAccount = async () => {
    if (isUploadingAttachment) {
      showToast('Hay archivos adjuntos subiéndose. Por favor, espera a que terminen.', 'error')
      return
    }

    const finalName = platformQuery.trim()
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
              id: generateId(),
              password: previousPassword,
              changedAt: new Date().toISOString(),
            },
          ].slice(-10),
        }
      : account

    const updatedWithName = { ...accountWithHistory, name: finalName }

    let finalBreachCount = exposedCheckCount
    const currentPassword = passwordValue(updatedWithName)
    if (currentPassword) {
      if (finalBreachCount === null || currentPassword !== initialPasswordRef.current) {
        try {
          const { checkPasswordBreach } = await import('../utils/security')
          finalBreachCount = await checkPasswordBreach(currentPassword)
        } catch {
          finalBreachCount = null
        }
      }
    } else {
      finalBreachCount = null
    }

    const updatedWithBreach = {
      ...updatedWithName,
      exposedBreachCount: finalBreachCount,
      lastExposedCheckAt: finalBreachCount !== null ? new Date().toISOString() : undefined,
      ignoreExposedPasswordWarning: currentPassword !== initialPasswordRef.current ? false : updatedWithName.ignoreExposedPasswordWarning
    }

    const normalized = normalizeAccount(accountForPersistence(updatedWithBreach))
    if (!normalized.name) {
      showToast('Indica el nombre de la plataforma.', 'error')
      return
    }
    if (normalized.accessMethods.length === 0 && !normalized.linkedPhone) {
      showToast('Activa al menos una vía de acceso o provee un teléfono para esta cuenta.', 'error')
      return
    }

    setSaving(true)
    try {
      let finalIdentityId = targetIdentityId
      if (showNewIdentityInput && newIdentityEmail.trim()) {
        const newIdent = await addIdentity(newIdentityEmail.trim())
        finalIdentityId = newIdent.id
      }
      await onSave(normalized, finalIdentityId)
      setBaselineAccount(normalized)
      setPasswordEnabled(normalized.accessMethods.some((method) => method.type === 'PASSWORD'))
      onUnsavedStateChange?.(false, null)
    } catch (error) {
      showToast(getFriendlyErrorMessage(error, 'No se pudo guardar la cuenta.'))
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
    JSON.stringify(normalizeAccount(accountForPersistence({ ...account, name: platformQuery.trim() }))) !== JSON.stringify(normalizeAccount(baselineAccount))

  useEffect(() => {
    onUnsavedStateChange?.(isDirty, isDirty ? { save: saveCurrentAccount, discard: handleCancelEdit } : null)
    return () => onUnsavedStateChange?.(false, null)
  }, [isDirty, account, baselineAccount])

  const apiKeys = account.apiKeys ?? []

  const passkeyEnabled = account.accessMethods.some((method) => method.type === 'PASSKEY')
  const magicLinkMethod = account.accessMethods.find((method) => method.type === 'MAGIC_LINK')
  const ssoMethod = account.accessMethods.find((method) => method.type === 'SSO')

  const setAccessMethods = (updater: (methods: Account['accessMethods']) => Account['accessMethods']) => {
    setAccount((prev) => ({ ...prev, accessMethods: updater(prev.accessMethods) }))
  }

  const togglePassword = (enabled: boolean) => {
    setPasswordEnabled(enabled)
    if (!enabled || passwordMethod) return
    setAccessMethods((methods) => [...methods, { id: generateId(), type: 'PASSWORD', password: '' }])
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
        return [...filtered, { id: generateId(), type: 'SSO', providers: [], email: identityEmail }]
      }
      setSsoProviderQuery('')
      return filtered
    })
  }

  const toggleSsoProvider = (provider: SsoProvider, checked: boolean) => {
    setAccessMethods((methods) => methods.map((m) => {
      if (m.type === 'SSO') {
        const nextProviders = checked
          ? [...new Set([...m.providers, provider])]
          : m.providers.filter(p => p !== provider)
        return { ...m, providers: nextProviders }
      }
      return m
    }))
  }

  const addTwoFactorConfig = (type: TwoFactorType) => {
    const list = account.twoFactorAuths || []
    const newConfig: TwoFactorConfig = {
      id: generateId(),
      type,
      pin: type === 'PIN' ? '' : null,
      secret: type === 'TOTP' ? '' : null,
      authenticatorApp: type === 'TOTP' ? '' : null,
      phone: type === 'SMS' ? '' : null,
    }
    const nextList = [...list, newConfig]
    setAccount((prev) => ({
      ...prev,
      twoFactorAuths: nextList,
      twoFactorAuth: nextList[0] || { type: 'NONE', pin: null, secret: null, authenticatorApp: null },
    }))
  }

  const removeTwoFactorConfig = (id: string) => {
    const list = account.twoFactorAuths || []
    const nextList = list.filter(c => c.id !== id)
    setAccount((prev) => ({
      ...prev,
      twoFactorAuths: nextList,
      twoFactorAuth: nextList[0] || { type: 'NONE', pin: null, secret: null, authenticatorApp: null },
    }))
  }

  const updateTwoFactorConfigDetail = (id: string, field: keyof TwoFactorConfig, value: any) => {
    const list = account.twoFactorAuths || []
    const nextList = list.map(c => c.id === id ? { ...c, [field]: value } : c)
    setAccount((prev) => ({
      ...prev,
      twoFactorAuths: nextList,
      twoFactorAuth: nextList[0] || { type: 'NONE', pin: null, secret: null, authenticatorApp: null },
    }))
  }

  const updateSsoEmail = (email: string) => {
    setAccessMethods((methods) => methods.map((m) => (m.type === 'SSO' ? { ...m, email: email.trim() || identityEmail } : m)))
  }

  const togglePasskey = (enabled: boolean) => {
    setAccessMethods((methods) =>
      enabled
        ? [...methods, { id: generateId(), type: 'PASSKEY' }]
        : methods.filter((method) => method.type !== 'PASSKEY'),
    )
  }

  const toggleMagicLink = (enabled: boolean) => {
    setAccessMethods((methods) =>
      enabled
        ? [...methods, { id: generateId(), type: 'MAGIC_LINK', email: identityEmail }]
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
        <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-white/90 dark:bg-[#0f0f10]/90 px-4 py-3 backdrop-blur-xl lg:px-8 lg:py-4">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={onCancel} className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover" aria-label="Volver">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <PlatformLogo name={account.name} className="h-8 w-8 shrink-0 rounded-xl" />
            <h2 className="truncate text-lg font-bold tracking-tight text-text-primary">{account.name}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isUnlocked ? (
              <button
                type="button"
                onClick={handleGlobalUnlock}
                className="flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/10 px-3 py-2 sm:px-4 text-sm font-semibold text-text-primary transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
                title="Desbloquear vista completa"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h16.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span className="hidden sm:inline">Desbloquear vista</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 sm:px-4 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75M3.75 21.75h16.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span className="hidden sm:inline">Vista desbloqueada</span>
              </div>
            )}
            {onShare && (
              <button type="button" onClick={onShare} className="flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/10 px-3 py-2 sm:px-4 text-sm font-semibold text-text-primary transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-95" title="Compartir">
                <svg className="w-4 h-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
                <span className="hidden sm:inline">Compartir</span>
              </button>
            )}
            <button type="button" onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 shrink-0 rounded-xl bg-slate-900 dark:bg-white px-3 py-2 sm:px-5 sm:py-2.5 text-sm font-semibold text-white dark:text-black shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95" title="Editar">
              <svg className="w-4 h-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.89l12.685-12.684z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125L16.875 4.5" />
              </svg>
              <span className="hidden sm:inline">Editar</span>
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 lg:px-8">
          {account.tags && account.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1 mb-2">
              {account.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center rounded-full border border-black/5 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadOnlyField label="Usuario" value={account.username} />
          {passwordMethod && (
            <div className="flex flex-col gap-2">
              <ReadOnlyField label="Contraseña" value={passwordMethod.password} isSecret autoReveal={isUnlocked} />
              {!account.ignoreWeakPasswordWarning && hasWeakPassword(account) && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-200/80 border border-amber-100 dark:border-amber-700/50">
                  <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Contraseña débil o reutilizada.
                </div>
              )}
            </div>
          )}
          {account.linkedPhone && <ReadOnlyField label="Teléfono vinculado" value={account.linkedPhone} />}
          {ssoMethod && <ReadOnlyField label={`Login con ${ssoMethod.providers.join(', ')}`} value={ssoMethod.email || identityEmail} />}
          {passkeyEnabled && <ReadOnlyField label="Biometría / Passkey" value="Activado" />}
          {magicLinkMethod && <ReadOnlyField label="Magic Link" value={magicLinkMethod.email || identityEmail} />}
          {account.hardwareKey && <ReadOnlyField label="Llave Física (YubiKey)" value="Activada" />}
        </div>

        {(() => {
          const list2FA = (account.twoFactorAuths && account.twoFactorAuths.length > 0)
            ? account.twoFactorAuths
            : (() => {
                const legacy = getTwoFactorConfig(account.twoFactorAuth)
                return legacy.type !== 'NONE' ? [{ ...legacy, phone: null }] : []
              })()
          
          return (list2FA.length > 0 || apiKeys.length > 0) && (
            <div className="space-y-3 pt-2">
              <div className="px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Seguridad avanzada</h3>
                <p className="mt-1 text-xs text-text-secondary">Los factores extra y secretos técnicos se presentan como activos protegidos, más claros y más fáciles de revisar.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {list2FA.map((cfg) => {
                  let displayTitle = 'Segundo factor'
                  let displayDescription = ''
                  let displaySecret = null
                  if (cfg.type === 'TOTP') {
                    displayTitle = cfg.authenticatorApp || 'Authenticator configurado'
                    displayDescription = 'La app de autenticación y su clave manual quedan agrupadas en una ficha segura y legible.'
                    displaySecret = cfg.secret
                  } else if (cfg.type === 'SMS') {
                    displayTitle = 'SMS de Respaldo'
                    displayDescription = `El segundo factor depende del teléfono vinculado y el número de teléfono: ${cfg.phone || 'No especificado'}.`
                    displaySecret = null
                  } else if (cfg.type === 'PIN') {
                    displayTitle = 'PIN de Seguridad'
                    displayDescription = 'PIN de seguridad configurado.'
                    displaySecret = cfg.pin
                  }
                  
                  return (
                    <SecuritySummaryCard
                      key={cfg.id}
                      eyebrow="2FA"
                      title={displayTitle}
                      description={displayDescription}
                      secret={displaySecret}
                      actionLabel={cfg.type === 'TOTP' ? 'Authenticator' : cfg.type === 'SMS' ? 'SMS' : 'PIN'}
                      isTotp={cfg.type === 'TOTP'}
                      autoReveal={isUnlocked}
                    />
                  )
                })}
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
                        onAccess={handleItemAccessed}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) })()}
        {account.recoveryCodes && (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-text-tertiary px-1 uppercase tracking-wider">Códigos de Recuperación</h3>
            <ReadOnlyField label="Códigos de emergencia" value={account.recoveryCodes} isSecret isMultiline onAccess={handleItemAccessed} />
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
            onAccess={handleItemAccessed}
          />
        ))}
        {(account.attachments ?? []).length > 0 && (
          <div className="mt-4 rounded-2xl border border-black/5 bg-black/[0.02] p-4 shadow-sm">
            <AttachmentsList
              attachments={account.attachments || []}
              readOnly={true}
            />
          </div>
        )}
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
          <button type="button" onClick={handleCancelClick} className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover" aria-label="Volver">
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
          <button type="submit" disabled={saving || isUploadingAttachment} title={saving ? 'Guardando…' : mode === 'create' ? 'Crear cuenta' : 'Guardar cambios'} className="flex items-center justify-center gap-1.5 rounded-xl bg-text-primary px-3 py-2.5 sm:px-5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 active:scale-95">
            {saving ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : mode === 'create' ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="hidden sm:inline">Crear cuenta</span>
              </>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 lg:px-8">
      <section className="space-y-5 rounded-2xl border border-black/[0.08] bg-gradient-to-b from-white to-slate-50/80 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] backdrop-blur">
        <div className="flex flex-row justify-between items-end border-b border-border-subtle pb-3">
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-text-primary">Credenciales Principales</h3>
            <p className="text-[10px] font-medium text-text-tertiary">Plataforma, usuario, contraseña y vías de acceso.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-text-primary">Identidad (Email)</label>
            <select
              value={showNewIdentityInput ? 'NEW' : targetIdentityId}
              onChange={(e) => {
                if (e.target.value === 'NEW') {
                  setShowNewIdentityInput(true)
                } else {
                  setShowNewIdentityInput(false)
                  setTargetIdentityId(e.target.value)
                }
              }}
              className="w-full rounded-xl border border-border-default bg-surface-primary px-3 py-2.5 text-sm font-medium text-text-primary outline-none transition-all focus:border-black focus:ring-2 focus:ring-black/5"
            >
              {identities.map((ident) => (
                <option key={ident.id} value={ident.id}>{ident.email}</option>
              ))}
              <option value="NEW">+ Añadir nueva identidad</option>
            </select>
          </div>
          {showNewIdentityInput && (
            <div className="flex flex-col gap-1.5 animate-vault-morph">
              <label className="text-sm font-semibold text-text-primary">Nuevo Correo</label>
              <input
                type="email"
                placeholder="ejemplo@gmail.com"
                value={newIdentityEmail}
                onChange={(e) => setNewIdentityEmail(e.target.value)}
                autoFocus
                className="w-full rounded-xl border border-border-default bg-surface-primary px-3 py-2.5 text-sm text-text-primary outline-none transition-all focus:border-black focus:ring-2 focus:ring-black/5"
              />
            </div>
          )}
          <Combobox
            label="Plataforma"
            value={platformQuery}
            options={PLATFORM_OPTIONS}
            onInputChange={setPlatformQuery}
            onChange={(value) => {
              const known = POPULAR_SERVICES.find((s) => s.name.toLowerCase() === value.toLowerCase())
              const finalValue = known ? known.name : value
              updateField('name', finalValue)
              setPlatformQuery(finalValue)
            }}
            placeholder="Amazon, GitHub, Stripe..."
          />
          <FormField
            label="Usuario"
            value={account.username}
            onChange={(e) => updateField('username', e.target.value)}
            placeholder="usuario o correo de login"
            autoComplete="off"
          />
          <div className="col-span-1 sm:col-span-2">
            <label className="text-sm font-semibold text-text-primary mb-1.5 block">Etiquetas (Tags)</label>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-default bg-surface-primary px-3 py-2">
              {(account.tags || []).map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                  #{tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)} className="text-slate-400 hover:text-slate-600">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder="Añadir tag y pulsar Enter..."
                className="flex-1 min-w-[120px] bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag(e.currentTarget.value)
                    e.currentTarget.value = ''
                  } else if (e.key === 'Backspace' && e.currentTarget.value === '' && (account.tags || []).length > 0) {
                    const tags = account.tags || []
                    handleRemoveTag(tags[tags.length - 1])
                  }
                }}
              />
            </div>
          </div>
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
            <div className={`space-y-3 ${passwordEnabled && passwordMethod ? 'overflow-visible' : 'overflow-hidden'}`}>
              {passwordEnabled && passwordMethod && (
                <>
                  <PasswordField
                    label="Contraseña"
                    value={passwordMethod.password}
                    onChange={updatePasswordMethod}
                    placeholder="••••••••"
                    required
                    showGenerator
                    forceVisible={isUnlocked}
                    onAccess={handleItemAccessed}
                  />
                  {/* Análisis de Seguridad Dinámico */}
                  {passwordMethod.password && (
                    <div className="mt-3 space-y-3 rounded-2xl border border-black/[0.05] bg-slate-50/50 p-3.5 dark:border-white/5 dark:bg-slate-900/30 animate-vault-slide-up">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-secondary dark:text-slate-400">
                        Análisis de Seguridad
                      </h4>

                      {/* Fortaleza de la Contraseña */}
                      {(() => {
                        const evaluation = evaluatePassword(passwordMethod.password)
                        return (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${evaluation.isWeak ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                              <span className="text-xs font-bold text-text-primary dark:text-slate-200">
                                {evaluation.isWeak ? 'Fortaleza débil' : 'Fortaleza segura'}
                              </span>
                            </div>
                            {evaluation.isWeak && (
                              <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/20 p-2.5 border border-amber-100/60 dark:border-amber-900/30 space-y-1">
                                <ul className="list-disc pl-4 text-[11px] text-amber-900 dark:text-amber-300/80 leading-relaxed space-y-0.5">
                                  {evaluation.reasons.map((r, idx) => <li key={idx}>{r}</li>)}
                                </ul>
                                {evaluation.recommendations.length > 0 && (
                                  <div className="text-[11px] text-amber-800 dark:text-amber-200 font-semibold pt-0.5 pl-1">
                                    Recomendación: {evaluation.recommendations.join(' ')}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* Comprobación de Filtraciones (HIBP) */}
                      <div className="border-t border-black/[0.04] dark:border-white/[0.04] pt-2.5 flex items-center justify-between text-xs">
                        <span className="text-text-secondary dark:text-slate-400 font-medium">Buscador de filtraciones:</span>
                        {isCheckingExposed ? (
                          <span className="flex items-center gap-1.5 text-text-tertiary dark:text-slate-500 font-medium">
                            <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Comprobando...
                          </span>
                        ) : exposedCheckCount !== null ? (
                          exposedCheckCount > 0 ? (
                            <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold">
                              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Expuesta ({exposedCheckCount.toLocaleString()})
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                              </svg>
                              Sin filtraciones
                            </span>
                          )
                        ) : (
                          <span className="text-text-tertiary dark:text-slate-500 font-medium">Pendiente de auditar</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <label className="mt-4 flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3 transition-colors hover:bg-amber-100/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={account.ignoreWeakPasswordWarning ?? false}
                      onChange={(e) => setAccount({ ...account, ignoreWeakPasswordWarning: e.target.checked })}
                      className="h-5 w-5 shrink-0 rounded-md border border-amber-300 bg-white text-amber-600 accent-amber-600 focus:ring-2 focus:ring-amber-500/20"
                    />
                    <div>
                      <span className="block text-sm font-bold text-amber-900">Ignorar en auditoría</span>
                      <span className="block text-xs text-amber-800">No mostrar la advertencia de contraseña débil para esta cuenta.</span>
                    </div>
                  </label>
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
        <div className="mt-4 pt-4 border-t border-black/[0.08]">
          <h3 className="text-lg font-bold text-text-primary mb-3">Otros métodos de inicio de sesión</h3>
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
                        value={ssoProviderQuery}
                        options={SSO_OPTIONS.filter(o => !ssoMethod.providers.includes(o.label))}
                        onInputChange={setSsoProviderQuery}
                        onChange={(val) => {
                          toggleSsoProvider(val, true)
                          setSsoProviderQuery('')
                        }}
                        placeholder="Apple, Discord, Okta, LinkedIn..."
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
                  Passkey / Biometría del dispositivo
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
        </div>

        <div className="flex flex-wrap gap-4 rounded-2xl border border-black/[0.04] bg-surface/40 p-4">
          <label className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-[15px] font-semibold text-text-primary transition-colors hover:bg-white/70">
            <input
              type="checkbox"
              className={checkboxClassName}
              checked={account.hardwareKey}
              onChange={(event) => updateField('hardwareKey', event.target.checked)}
            />
            Llave física de seguridad (FIDO2 / YubiKey)
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_14px_45px_rgba(15,23,42,0.045)]">
        <h3 className="text-lg font-bold text-text-primary mb-4">Seguridad Extra</h3>

        {/* Segundos Factores (2FA) */}
        <div className="space-y-4 rounded-xl border border-black/[0.05] bg-surface-primary/30 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="block text-sm font-semibold text-text-primary">Segundos factores (2FA)</span>
              <p className="mt-1 text-xs text-text-secondary">Configura tus llaves OTP, PINs, SMS o Email de verificación.</p>
            </div>
            {/* Botón para añadir un factor */}
            <div className="relative inline-block text-left">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    addTwoFactorConfig(e.target.value as TwoFactorType)
                    e.target.value = ''
                  }
                }}
                className="rounded-lg border border-black/5 bg-surface px-3 py-1.5 text-xs font-bold text-text-primary transition-colors hover:bg-surface-hover outline-none cursor-pointer"
              >
                <option value="" disabled>+ Añadir 2FA</option>
                <option value="TOTP">App Autenticadora (TOTP)</option>
                <option value="PIN">PIN de Seguridad</option>
                <option value="SMS">SMS de Respaldo</option>
                <option value="EMAIL">Correo Electrónico (Email)</option>
              </select>
            </div>
          </div>

          {/* List of configured 2FA methods */}
          <div className="space-y-3">
            {(account.twoFactorAuths || []).length === 0 ? (
              <p className="text-xs text-text-tertiary italic text-center py-2">Ningún segundo factor configurado.</p>
            ) : (
              (account.twoFactorAuths || []).map((cfg) => (
                <div key={cfg.id} className="relative rounded-xl border border-black/[0.05] bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-black/[0.03] pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                      {cfg.type === 'TOTP' && '🔒 App Autenticadora (TOTP)'}
                      {cfg.type === 'PIN' && '🔑 PIN de Seguridad'}
                      {cfg.type === 'SMS' && '📱 SMS de Respaldo'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTwoFactorConfig(cfg.id)}
                      className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>

                  {cfg.type === 'PIN' && (
                    <FormField
                      label="PIN"
                      type="password"
                      inputMode="numeric"
                      value={cfg.pin ?? ''}
                      onChange={(e) => updateTwoFactorConfigDetail(cfg.id, 'pin', e.target.value)}
                      placeholder="Introduce tu PIN"
                      autoComplete="off"
                    />
                  )}

                  {cfg.type === 'EMAIL' && (
                    <FormField
                      label="Correo Electrónico (Email 2FA)"
                      type="email"
                      value={cfg.phone ?? ''}
                      onChange={(e) => updateTwoFactorConfigDetail(cfg.id, 'phone', e.target.value)}
                      placeholder="email@ejemplo.com"
                      autoComplete="off"
                    />
                  )}

                  {cfg.type === 'SMS' && (
                    <FormField
                      label="Número de Teléfono"
                      type="tel"
                      value={cfg.phone ?? ''}
                      onChange={(e) => updateTwoFactorConfigDetail(cfg.id, 'phone', e.target.value)}
                      placeholder="+34 600 000 000"
                      autoComplete="off"
                    />
                  )}

                  {cfg.type === 'TOTP' && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Combobox
                        label="¿Qué app de autenticación usas?"
                        value={cfg.authenticatorApp ?? ''}
                        options={AUTHENTICATOR_APP_OPTIONS}
                        onChange={(value) => updateTwoFactorConfigDetail(cfg.id, 'authenticatorApp', value)}
                        placeholder="Google Authenticator, Authy..."
                        createLabel={(input) => `Usar "${input}"`}
                      />
                      <div className="relative">
                        <label className="mb-1.5 block text-xs font-semibold text-text-secondary">
                          Clave de configuración (Secreto)
                          <span className="ml-1 cursor-help text-blue-500" title="Esta es la semilla base32 que enlaza tu app de autenticación (ej: Authenticator) para generar los códigos 2FA. Guárdala si quieres poder restaurar los códigos en el futuro sin escanear el QR." >
                            ⓘ
                          </span>
                        </label>
                        <div className="flex items-center">
                          {isUnlocked ? (
                            <input
                              type="text"
                              value={cfg.secret ?? ''}
                              onChange={(e) => updateTwoFactorConfigDetail(cfg.id, 'secret', e.target.value)}
                              placeholder="Secreto TOTP (Base32)"
                              autoComplete="off"
                              className="w-full rounded-xl border border-border-default bg-surface-primary px-3 py-2.5 text-sm text-text-primary outline-none transition-all focus:border-black focus:ring-2 focus:ring-black/5"
                            />
                          ) : (
                            <div className="flex h-10 w-full items-center rounded-xl border border-black/[0.05] bg-black/[0.02] px-3 font-mono text-sm tracking-[0.2em] text-text-secondary select-none">
                              ••••••••••••
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_14px_45px_rgba(15,23,42,0.045)]">
        <h3 className="text-lg font-bold text-text-primary mb-4">Información de la Cuenta</h3>
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
        </div>

        <FormTextarea
          label="Notas generales"
          value={account.notes ?? ''}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Notas libres, respuestas de recuperación, contexto operativo..."
        />
        <div className="mt-4">
          <TagsInput 
            tags={account.tags || []} 
            onChange={(tags) => updateField('tags', tags)} 
          />
        </div>
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
                        style={(field.protected && !isUnlocked) ? ({ WebkitTextSecurity: 'disc' } as CSSProperties) : undefined}
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


              <div className="mt-4 rounded-2xl border border-black/5 bg-black/[0.02] p-4 shadow-sm">
                <AttachmentsList
                  attachments={account.attachments || []}
                  onAttachmentsChange={(attachments) => setAccount({ ...account, attachments })}
                  onUploadingChange={setIsUploadingAttachment}
                />
              </div>
            </div>
          </div>
        </Accordion>
      </section>

      <section className="mb-24">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-red-900">Danger Zone</h3>
                <p className="mt-1 text-xs leading-relaxed text-red-800/80">Opciones visibles siempre. Úsalas solo para cuentas especialmente sensibles.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-red-100">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-red-900">Desactivar sincronización en la nube</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-red-800/75">La cuenta queda solo en este dispositivo y no se sube a Firebase.</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" className="peer sr-only" checked={Boolean(account.isLocalOnly)} onChange={(e) => setAccount({ ...account, isLocalOnly: e.target.checked })} />
                      <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-red-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-red-300"></div>
                    </label>
                  </div>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-red-100">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-red-900">Ocultar en Modo Viaje</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-red-800/75">La cuenta se oculta cuando el Modo Viaje está activo.</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" className="peer sr-only" checked={Boolean(account.sensitive)} onChange={(event) => updateField('sensitive', event.target.checked)} />
                      <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-red-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-red-300"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      

      </div>

      {/* Modal Seguro de Borrado */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm rounded-[2rem] bg-white shadow-[0_32px_80px_rgba(0,0,0,0.22)] overflow-hidden animate-in zoom-in-95 duration-200"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-platform-title"
          >
            {/* Header */}
            <div className="bg-red-50 px-6 pt-6 pb-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 shadow-inner">
                <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h2 id="delete-platform-title" className="text-lg font-black text-red-900 tracking-tight">Eliminar plataforma</h2>
              <p className="mt-1.5 text-sm text-red-700 leading-relaxed">
                Esta acción eliminará permanentemente la plataforma junto con todas sus contraseñas y API Keys. No se puede deshacer.
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label htmlFor="delete-platform-input" className="block text-xs font-bold text-slate-600 mb-2">
                  Escribe <span className="font-black text-red-600 tracking-widest">ELIMINAR</span> para confirmar
                </label>
                <input
                  id="delete-platform-input"
                  type="text"
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="ELIMINAR"
                  className={`w-full rounded-xl border px-4 py-3 text-sm font-mono font-bold tracking-widest outline-none transition-all ${
                    deleteConfirmText === 'ELIMINAR'
                      ? 'border-red-400 bg-red-50 text-red-700 focus:ring-2 focus:ring-red-300'
                      : 'border-slate-200 bg-slate-50 text-slate-700 focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
                  }`}
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => { setShowDeleteModal(false); setDeleteConfirmText('') }}
                  className="flex-1 rounded-xl border border-black/8 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deleteConfirmText !== 'ELIMINAR'}
                  onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); onDelete?.() }}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-red-600/20 transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}

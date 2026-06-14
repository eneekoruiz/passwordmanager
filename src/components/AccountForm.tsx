import { useState, useEffect, type FormEvent, type CSSProperties } from 'react'
import type { Account, ApiKeyEntry } from '../types'
import { createEmptyAccount } from '../utils/account'
import { createApiKeyEntry, normalizeAccount } from '../utils/normalizeAccount'
import { Accordion } from './ui/Accordion'
import { FormField, FormTextarea } from './ui/FormField'
import { PasswordField } from './ui/PasswordField'
import { copyToClipboard } from '../utils/clipboard'
import { getFriendlyErrorMessage } from '../utils/errors'

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

  const [recoveryCodesVisible, setRecoveryCodesVisible] = useState(false)
  const [recoveryCodesCopied, setRecoveryCodesCopied] = useState(false)

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
  const ssoMethods = account.accessMethods.filter((method) => method.type === 'SSO')

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

  const toggleSsoProvider = (provider: 'Google' | 'Apple', enabled: boolean) => {
    setAccessMethods((methods) =>
      enabled
        ? [...methods, { id: crypto.randomUUID(), type: 'SSO', provider, email: identityEmail }]
        : methods.filter((method) => method.type !== 'SSO' || method.provider !== provider),
    )
  }

  const updateSsoEmail = (provider: 'Google' | 'Apple', email: string) => {
    setAccessMethods((methods) =>
      methods.map((method) =>
        method.type === 'SSO' && method.provider === provider
          ? { ...method, email: email.trim() || identityEmail }
          : method,
      ),
    )
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

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-8 pb-12 select-none animate-fade-in font-sans">
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
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-text-primary">Vías de Acceso</h4>
              <p className="mt-0.5 text-[10px] font-medium text-text-tertiary">
                Puedes activar varias formas de entrar en la misma plataforma.
              </p>
            </div>
            <label className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-xs font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={account.hardwareKey}
                onChange={(event) => updateField('hardwareKey', event.target.checked)}
              />
              YubiKey
            </label>
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

            {(['Google', 'Apple'] as const).map((provider) => {
              const method = ssoMethods.find((item) => item.provider === provider)
              return (
                <div key={provider} className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                    <input
                      type="checkbox"
                      checked={Boolean(method)}
                      onChange={(event) => toggleSsoProvider(provider, event.target.checked)}
                    />
                    Login con {provider}
                  </label>
                  {method && (
                    <FormField
                      label={`Correo usado en ${provider}`}
                      type="email"
                      value={method.email ?? ''}
                      onChange={(event) => updateSsoEmail(provider, event.target.value)}
                      placeholder={identityEmail}
                      autoComplete="off"
                    />
                  )}
                </div>
              )
            })}

            <label className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={passkeyEnabled}
                onChange={(event) => togglePasskey(event.target.checked)}
              />
              Passkey / biometría
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={Boolean(magicLinkMethod)}
                onChange={(event) => toggleMagicLink(event.target.checked)}
              />
              Magic link
            </label>
            {magicLinkMethod && (
              <FormField
                label="Correo para magic link"
                type="email"
                value={magicLinkMethod.email ?? ''}
                onChange={(event) => updateMagicLinkEmail(event.target.value)}
                placeholder={identityEmail}
                autoComplete="off"
              />
            )}
          </div>
        </div>
      </section>

      {/* 2. Opciones avanzadas: menos ruido para el uso diario */}
      <section className="pt-2">
        <Accordion title="Opciones avanzadas / Seguridad extra">
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
              onClick={() => onDelete()}
              className="text-sm font-semibold text-red-600 hover:text-red-700 active:scale-95 transition-all"
            >
              Eliminar cuenta
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-hover"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-text-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : mode === 'create' ? 'Crear cuenta' : 'Guardar'}
          </button>
        </div>
      </div>
    </form>
  )
}

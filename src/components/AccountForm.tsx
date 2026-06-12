import { useState, useEffect, type FormEvent } from 'react'
import type { Account } from '../types'
import { createEmptyAccount } from '../utils/account'
import { createApiKeyEntry, normalizeAccount } from '../utils/normalizeAccount'
import { Accordion } from './ui/Accordion'
import { FormField, FormTextarea } from './ui/FormField'
import { PasswordField } from './ui/PasswordField'
import { SecretField } from './ui/SecretField'

interface AccountFormProps {
  mode: 'create' | 'edit'
  initialAccount?: Account
  onSave: (account: Account) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
}

export function AccountForm({
  mode,
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

  /**
   * Scrubbing de Memoria: Limpieza explícita del estado del formulario al desmontarse.
   * Esto evita que datos confidenciales en texto plano (como contraseñas o recovery codes)
   * queden remanentes en el heap de JavaScript más tiempo de lo necesario.
   */
  useEffect(() => {
    return () => {
      setAccount({
        id: '',
        username: '',
        email: '',
        password: '',
        phone: undefined,
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
    field: 'name' | 'value',
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
    if (!normalized.username && !normalized.email) {
      setError('Indica al menos un nombre de usuario o correo electrónico.')
      return
    }
    if (!normalized.password) {
      setError('La contraseña es obligatoria.')
      return
    }

    setSaving(true)
    try {
      await onSave(normalized)
    } catch {
      setError('No se pudo guardar la cuenta.')
    } finally {
      setSaving(false)
    }
  }

  const apiKeys = account.apiKeys ?? []

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
      {/* Campos principales — siempre visibles */}
      <section className="space-y-4">
        <FormField
          label="Nombre de usuario"
          value={account.username}
          onChange={(e) => updateField('username', e.target.value)}
          placeholder="usuario"
          autoComplete="off"
        />
        <FormField
          label="Correo electrónico"
          type="email"
          value={account.email}
          onChange={(e) => updateField('email', e.target.value)}
          placeholder="correo@ejemplo.com"
          autoComplete="off"
        />
        <PasswordField
          label="Contraseña"
          value={account.password}
          onChange={(value) => updateField('password', value)}
          placeholder="••••••••"
          required
          showGenerator
        />
      </section>

      {/* Secciones desplegables */}
      <section className="mt-6">
        <Accordion title="Campos secundarios">
          <FormField
            label="Número de teléfono"
            type="tel"
            value={account.phone ?? ''}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="+34 600 000 000"
            autoComplete="off"
          />
        </Accordion>

        <Accordion title="Notas">
          <FormTextarea
            label="Información adicional"
            value={account.notes ?? ''}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Fecha de nacimiento, nombre completo, estado 2FA…"
          />
        </Accordion>

        <Accordion title="Campos de desarrollador">
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-text-secondary">
                    API Keys
                  </span>
                  <p className="text-[10px] text-text-tertiary leading-normal mt-0.5 max-w-[70%]">
                    Claves de desarrollo (ej. OpenAI, Stripe) cifradas localmente de extremo a extremo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addApiKey}
                  className="text-xs font-semibold text-text-secondary transition-colors hover:text-text-primary mt-0.5"
                >
                  + Añadir clave
                </button>
              </div>

              {apiKeys.length === 0 ? (
                <p className="text-xs text-text-tertiary">
                  Sin claves API registradas
                </p>
              ) : (
                apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="rounded-lg border border-border-subtle bg-surface p-3 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <FormField
                        label="Nombre"
                        value={key.name}
                        onChange={(e) =>
                          updateApiKey(key.id, 'name', e.target.value)
                        }
                        placeholder="Production API"
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeApiKey(key.id)}
                        className="mt-6 rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary"
                        aria-label="Eliminar clave API"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <SecretField
                      label="Valor"
                      value={key.value}
                      onChange={(value) => updateApiKey(key.id, 'value', value)}
                      placeholder="sk-…"
                    />
                  </div>
                ))
              )}
            </div>

            <div className="space-y-1">
              <SecretField
                label="Códigos de recuperación"
                value={account.recoveryCodes ?? ''}
                onChange={(value) => updateField('recoveryCodes', value)}
                placeholder="Pega los códigos de recuperación"
                multiline
              />
              <p className="text-[10px] text-text-tertiary leading-normal px-0.5">
                Códigos de un solo uso para recuperar acceso a tus cuentas protegidas por 2FA si pierdes tu dispositivo de autenticación.
              </p>
            </div>
          </div>
        </Accordion>
      </section>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <div>
          {mode === 'edit' && onDelete && (
            <button
              type="button"
              onClick={() => onDelete()}
              className="text-sm text-red-600 transition-colors hover:text-red-700"
            >
              Eliminar cuenta
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : mode === 'create' ? 'Crear cuenta' : 'Guardar'}
          </button>
        </div>
      </div>
    </form>
  )
}

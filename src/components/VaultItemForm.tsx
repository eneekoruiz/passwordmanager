import { useState, type FormEvent } from 'react'
import type { LocalVaultItem, WifiSecurityType } from '../types'
import { normalizeLocalVaultItem, WIFI_SECURITY_OPTIONS } from '../utils/vaultItem'
import { getFriendlyErrorMessage } from '../utils/errors'
import { FormField, FormTextarea } from './ui/FormField'
import { SecretField } from './ui/SecretField'

interface VaultItemFormProps {
  item: LocalVaultItem
  onSave: (item: LocalVaultItem) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
}

function itemTitle(item: LocalVaultItem): string {
  if (item.type === 'WIFI') return 'Red Wi-Fi'
  if (item.type === 'SOFTWARE_LICENSE') return 'Licencia de software'
  if (item.type === 'FINANCE') return 'Dato financiero'
  return 'Nota segura'
}

export function VaultItemForm({ item, onSave, onCancel, onDelete }: VaultItemFormProps) {
  const [draft, setDraft] = useState<LocalVaultItem>(item)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const normalized = normalizeLocalVaultItem(draft)
      await onSave(normalized)
    } catch (caughtError) {
      setError(getFriendlyErrorMessage(caughtError, 'No se pudo guardar el secreto.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6 pb-12 animate-fade-in">
      <section className="rounded-3xl border border-border-subtle bg-white p-5 shadow-subtle">
        <div className="mb-5 border-b border-border-subtle pb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-tertiary">{item.type}</p>
          <h3 className="mt-1 text-base font-bold text-text-primary">{itemTitle(item)}</h3>
        </div>

        <div className="space-y-4">
          <FormField
            label="Título"
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Nombre visible en la bóveda"
          />

          {draft.type === 'WIFI' && (
            <>
              <FormField
                label="SSID"
                value={draft.ssid}
                onChange={(event) => setDraft((prev) => ({ ...prev, ssid: event.target.value }))}
                placeholder="Nombre de la red"
              />
              <SecretField
                label="Contraseña Wi-Fi"
                value={draft.password ?? ''}
                onChange={(value) => setDraft((prev) => ({ ...prev, password: value || null }))}
                placeholder="Clave de red"
              />
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-text-secondary">Seguridad</span>
                <select
                  value={draft.securityType}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      securityType: event.target.value as WifiSecurityType,
                    }))
                  }
                  className="w-full rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5 text-sm text-text-primary shadow-subtle outline-none transition-colors focus:border-border focus:ring-1 focus:ring-border/50"
                >
                  {WIFI_SECURITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          {draft.type === 'SOFTWARE_LICENSE' && (
            <>
              <FormField
                label="Software"
                value={draft.softwareName}
                onChange={(event) => setDraft((prev) => ({ ...prev, softwareName: event.target.value }))}
                placeholder="Final Cut Pro, Windows, JetBrains..."
              />
              <SecretField
                label="License Key"
                value={draft.licenseKey}
                onChange={(value) => setDraft((prev) => ({ ...prev, licenseKey: value }))}
                placeholder="XXXXX-XXXXX-XXXXX"
              />
            </>
          )}

          {draft.type === 'FINANCE' && (
            <>
              <SecretField
                label="Número de tarjeta"
                value={draft.cardNumber}
                onChange={(value) => setDraft((prev) => ({ ...prev, cardNumber: value }))}
                placeholder="•••• •••• •••• ••••"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SecretField
                  label="PIN"
                  value={draft.pin ?? ''}
                  onChange={(value) => setDraft((prev) => ({ ...prev, pin: value || null }))}
                />
                <SecretField
                  label="CVV"
                  value={draft.cvv ?? ''}
                  onChange={(value) => setDraft((prev) => ({ ...prev, cvv: value || null }))}
                />
                <FormField
                  label="Caducidad"
                  value={draft.expiry ?? ''}
                  onChange={(event) => setDraft((prev) => ({ ...prev, expiry: event.target.value || null }))}
                  placeholder="MM/AA"
                />
              </div>
            </>
          )}

          {draft.type === 'SECURE_NOTE' && (
            <FormTextarea
              label="Nota Markdown"
              value={draft.markdown}
              onChange={(event) => setDraft((prev) => ({ ...prev, markdown: event.target.value }))}
              placeholder="Escribe una nota privada..."
              className="min-h-[220px] font-mono"
            />
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border-subtle pt-5">
        <div>
          {onDelete && (
            <button type="button" onClick={() => void onDelete()} className="text-sm font-semibold text-red-600">
              Eliminar
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-hover">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-text-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </form>
  )
}

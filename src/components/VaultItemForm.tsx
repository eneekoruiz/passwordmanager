import { useState, type FormEvent } from 'react'
import type { LocalVaultItem, WifiSecurityType } from '../types'
import { normalizeLocalVaultItem, WIFI_SECURITY_OPTIONS } from '../utils/vaultItem'
import { getFriendlyErrorMessage } from '../utils/errors'
import { FormField, FormTextarea } from './ui/FormField'
import { SecretField } from './ui/SecretField'
import { Accordion } from './ui/Accordion'

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

      <section className="mt-6 mb-6">
        <Accordion title="Danger Zone (Sincronización Selectiva)" defaultOpen={Boolean(draft.isLocalOnly)}>
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
                  Si activas esta opción, este elemento <strong>nunca se subirá a la nube</strong> y solo existirá en este dispositivo.
                  Si desinstalas la aplicación o formateas el dispositivo, perderás este dato para siempre.
                </p>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-red-100">
                  <span className="text-sm font-semibold text-red-900">Modo Solo-Dispositivo</span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={Boolean(draft.isLocalOnly)}
                      onChange={(e) => setDraft((prev) => ({ ...prev, isLocalOnly: e.target.checked }))}
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

import { useState, useEffect, type FormEvent } from 'react'
import type { LocalVaultItem, WifiSecurityType, CustomFieldEntry } from '../types'
import { normalizeLocalVaultItem, WIFI_SECURITY_OPTIONS } from '../utils/vaultItem'
import { getFriendlyErrorMessage } from '../utils/errors'
import { generateId } from '../utils/id'
import { FormField, FormTextarea } from './ui/FormField'
import { SecretField } from './ui/SecretField'
import { UnsavedFormActions } from './AccountForm'

interface VaultItemFormProps {
  item: LocalVaultItem
  onSave: (item: LocalVaultItem) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
  onUnsavedStateChange?: (dirty: boolean, actions: UnsavedFormActions | null) => void
  onRequestNavigation?: (action: () => void) => void
}

interface FormFieldItem {
  id: string
  key: string
  value: string
  type: 'text' | 'password' | 'textarea' | 'select'
  options?: string[]
  isDefault?: boolean
}

function itemTitle(item: LocalVaultItem): string {
  if (item.type === 'WIFI') return 'Red Wi-Fi'
  if (item.type === 'SOFTWARE_LICENSE') return 'Licencia de software'
  if (item.type === 'FINANCE') return 'Dato financiero'
  return 'Nota segura'
}

function getInitialFields(item: LocalVaultItem): FormFieldItem[] {
  const fields: FormFieldItem[] = []
  
  if (item.type === 'WIFI') {
    fields.push({ id: 'ssid', key: 'SSID', value: item.ssid || '', type: 'text', isDefault: true })
    fields.push({ id: 'password', key: 'Contraseña Wi-Fi', value: item.password || '', type: 'password', isDefault: true })
    fields.push({ id: 'securityType', key: 'Seguridad', value: item.securityType || 'WPA2', type: 'select', options: WIFI_SECURITY_OPTIONS, isDefault: true })
  } else if (item.type === 'SOFTWARE_LICENSE') {
    fields.push({ id: 'softwareName', key: 'Software', value: item.softwareName || '', type: 'text', isDefault: true })
    fields.push({ id: 'licenseKey', key: 'License Key', value: item.licenseKey || '', type: 'password', isDefault: true })
  } else if (item.type === 'FINANCE') {
    fields.push({ id: 'cardNumber', key: 'Número de tarjeta', value: item.cardNumber || '', type: 'password', isDefault: true })
    fields.push({ id: 'pin', key: 'PIN', value: item.pin || '', type: 'password', isDefault: true })
    fields.push({ id: 'cvv', key: 'CVV', value: item.cvv || '', type: 'password', isDefault: true })
    fields.push({ id: 'expiry', key: 'Caducidad', value: item.expiry || '', type: 'text', isDefault: true })
  } else if (item.type === 'SECURE_NOTE') {
    fields.push({ id: 'markdown', key: 'Nota', value: item.markdown || '', type: 'textarea', isDefault: true })
  }

  // Cargar campos personalizados existentes
  if (Array.isArray(item.customFields)) {
    item.customFields.forEach((cf) => {
      fields.push({
        id: cf.id || generateId(),
        key: cf.key,
        value: cf.value,
        type: cf.type || (cf.protected ? 'password' : 'text'),
        options: cf.options || undefined,
        isDefault: false,
      })
    })
  }

  return fields
}

export function VaultItemForm({
  item,
  onSave,
  onCancel,
  onDelete,
  onUnsavedStateChange,
  onRequestNavigation,
}: VaultItemFormProps) {
  const [draft, setDraft] = useState<LocalVaultItem>(item)
  const [fields, setFields] = useState<FormFieldItem[]>(() => getInitialFields(item))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getDraftWithFields = (): LocalVaultItem => {
    const finalItem = { ...draft }

    // Escribir los valores por defecto de vuelta a las propiedades tipadas
    if (finalItem.type === 'WIFI') {
      finalItem.ssid = fields.find((f) => f.id === 'ssid')?.value || ''
      finalItem.password = fields.find((f) => f.id === 'password')?.value || null
      finalItem.securityType = (fields.find((f) => f.id === 'securityType')?.value as WifiSecurityType) || 'WPA2'
    } else if (finalItem.type === 'SOFTWARE_LICENSE') {
      finalItem.softwareName = fields.find((f) => f.id === 'softwareName')?.value || ''
      finalItem.licenseKey = fields.find((f) => f.id === 'licenseKey')?.value || ''
    } else if (finalItem.type === 'FINANCE') {
      finalItem.cardNumber = fields.find((f) => f.id === 'cardNumber')?.value || ''
      finalItem.pin = fields.find((f) => f.id === 'pin')?.value || null
      finalItem.cvv = fields.find((f) => f.id === 'cvv')?.value || null
      finalItem.expiry = fields.find((f) => f.id === 'expiry')?.value || null
    } else if (finalItem.type === 'SECURE_NOTE') {
      finalItem.markdown = fields.find((f) => f.id === 'markdown')?.value || ''
    }

    // Mapear campos dinámicos personalizados
    const customFields: CustomFieldEntry[] = fields
      .filter((f) => !f.isDefault)
      .map((f) => ({
        id: f.id,
        key: f.key.trim(),
        value: f.value.trim(),
        protected: f.type === 'password',
        type: f.type,
        options: f.options,
      }))

    finalItem.customFields = customFields.length > 0 ? customFields : undefined
    return finalItem
  }

  const saveCurrentItem = async () => {
    setError(null)
    setSaving(true)
    try {
      const normalized = normalizeLocalVaultItem(getDraftWithFields())
      await onSave(normalized)
    } catch (caughtError) {
      setError(getFriendlyErrorMessage(caughtError, 'No se pudo guardar el secreto.'))
      throw caughtError
    } finally {
      setSaving(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await saveCurrentItem()
    } catch {
      // Error ya manejado
    }
  }

  const isDirty =
    JSON.stringify(normalizeLocalVaultItem(getDraftWithFields())) !==
    JSON.stringify(normalizeLocalVaultItem(item))

  useEffect(() => {
    onUnsavedStateChange?.(isDirty, isDirty ? { save: saveCurrentItem, discard: onCancel } : null)
    return () => onUnsavedStateChange?.(false, null)
  }, [isDirty, draft, fields, item])

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

      if (e.key === 'Escape') {
        e.preventDefault()
        handleCancelClick()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDirty, onCancel, onRequestNavigation])

  const addField = (type: FormFieldItem['type']) => {
    const newField: FormFieldItem = {
      id: generateId(),
      key: type === 'text' ? 'Campo nuevo' : type === 'password' ? 'Secreto nuevo' : type === 'textarea' ? 'Nota nueva' : 'Selector nuevo',
      value: '',
      type,
      options: type === 'select' ? ['Opción 1', 'Opción 2'] : undefined,
      isDefault: false,
    }
    setFields((prev) => [...prev, newField])
  }

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id))
  }

  const updateFieldValue = (id: string, value: string) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, value } : f)))
  }

  const updateFieldKey = (id: string, key: string) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, key } : f)))
  }

  const updateFieldOptions = (id: string, options: string[]) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, options } : f)))
  }

  const handleCancelClick = () => {
    if (isDirty && onRequestNavigation) {
      onRequestNavigation(onCancel)
    } else {
      onCancel()
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6 pb-12 animate-fade-in select-none">
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

          <div className="border-t border-border-subtle pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Campos del Registro</span>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    addField(e.target.value as FormFieldItem['type'])
                    e.target.value = ''
                  }
                }}
                className="rounded-lg border border-black/5 bg-surface px-2.5 py-1.5 text-xs font-bold text-text-primary transition-colors hover:bg-surface-hover outline-none cursor-pointer"
              >
                <option value="" disabled>+ Añadir campo</option>
                <option value="text">Texto</option>
                <option value="password">Secreto / Password</option>
                <option value="textarea">Nota larga</option>
                <option value="select">Selector de opciones</option>
              </select>
            </div>

            <div className="space-y-3.5">
              {fields.map((field) => {
                if (field.isDefault) {
                  return (
                    <div key={field.id}>
                      {field.type === 'password' ? (
                        <SecretField
                          label={field.key}
                          value={field.value}
                          onChange={(val) => updateFieldValue(field.id, val)}
                          placeholder={`Introduce ${field.key}`}
                        />
                      ) : field.type === 'textarea' ? (
                        <FormTextarea
                          label={field.key}
                          value={field.value}
                          onChange={(e) => updateFieldValue(field.id, e.target.value)}
                          placeholder={`Escribe ${field.key}`}
                        />
                      ) : field.type === 'select' ? (
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-medium text-text-secondary">{field.key}</span>
                          <select
                            value={field.value}
                            onChange={(e) => updateFieldValue(field.id, e.target.value)}
                            className="w-full rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5 text-sm text-text-primary shadow-subtle outline-none transition-colors focus:border-border focus:ring-1 focus:ring-border/50"
                          >
                            {field.options?.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <FormField
                          label={field.key}
                          value={field.value}
                          onChange={(e) => updateFieldValue(field.id, e.target.value)}
                          placeholder={`Introduce ${field.key}`}
                        />
                      )}
                    </div>
                  )
                }

                // Campos personalizados y dinámicos
                return (
                  <div key={field.id} className="rounded-2xl border border-black/[0.04] bg-surface/30 p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-black/[0.03] pb-2">
                      <input
                        type="text"
                        value={field.key}
                        onChange={(e) => updateFieldKey(field.id, e.target.value)}
                        placeholder="Nombre de campo (ej. IBAN)"
                        className="text-xs font-bold uppercase tracking-wider text-text-secondary bg-transparent border-b border-transparent hover:border-black/10 focus:border-black/20 outline-none w-2/3"
                      />
                      <button
                        type="button"
                        onClick={() => removeField(field.id)}
                        className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>

                    {field.type === 'password' && (
                      <SecretField
                        label=""
                        value={field.value}
                        onChange={(val) => updateFieldValue(field.id, val)}
                        placeholder="Secreto cifrado"
                      />
                    )}

                    {field.type === 'textarea' && (
                      <FormTextarea
                        label=""
                        value={field.value}
                        onChange={(e) => updateFieldValue(field.id, e.target.value)}
                        placeholder="Nota larga cifrada"
                        className="min-h-[80px]"
                      />
                    )}

                    {field.type === 'select' && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField
                          label="Opciones (separadas por comas)"
                          value={field.options?.join(', ') ?? ''}
                          onChange={(e) => {
                            const opts = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                            updateFieldOptions(field.id, opts)
                          }}
                          placeholder="Opción A, Opción B, Opción C"
                        />
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-medium text-text-secondary">Selecciona valor</span>
                          <select
                            value={field.value}
                            onChange={(e) => updateFieldValue(field.id, e.target.value)}
                            className="w-full rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5 text-sm text-text-primary shadow-subtle outline-none transition-colors focus:border-border focus:ring-1 focus:ring-border/50"
                          >
                            {(field.options && field.options.length > 0 ? field.options : ['Sin opciones']).map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}

                    {field.type === 'text' && (
                      <FormField
                        label=""
                        value={field.value}
                        onChange={(e) => updateFieldValue(field.id, e.target.value)}
                        placeholder="Valor del campo"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 mb-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-red-900">Danger Zone</h3>
                <p className="mt-1 text-xs leading-relaxed text-red-800/80">
                  Opciones visibles siempre. Úsalas solo para secretos especialmente sensibles.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-red-100">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-red-900">Modo Solo-Dispositivo</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-red-800/75">El secreto queda solo en este dispositivo y no se sube a Firebase.</p>
                    </div>
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

                <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-red-100">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-red-900">Ocultar en Modo Viaje</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-red-800/75">El secreto se oculta cuando el Modo Viaje está activo.</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={Boolean(draft.sensitive)}
                        onChange={(e) => setDraft((prev) => ({ ...prev, sensitive: e.target.checked }))}
                      />
                      <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-red-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-red-300"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-700 animate-shake">
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
          <button type="button" onClick={handleCancelClick} className="rounded-lg px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-hover">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-text-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 active:scale-95 transition-all">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </form>
  )
}

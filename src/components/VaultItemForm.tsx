import { useState, useEffect, type FormEvent } from 'react'
import type { LocalVaultItem, WifiSecurityType, CustomFieldEntry } from '../types'
import { normalizeLocalVaultItem, WIFI_SECURITY_OPTIONS } from '../utils/vaultItem'
import { getFriendlyErrorMessage } from '../utils/errors'
import { generateId } from '../utils/id'
import { FormField, FormTextarea } from './ui/FormField'
import { SecretField } from './ui/SecretField'
import { UnsavedFormActions } from './AccountForm'
import { useVault } from '../context/VaultContext'
import { AttachmentsList } from './ui/AttachmentsList'


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
  } else if (item.type === 'INVOICE') {
    fields.push({ id: 'amount', key: 'Importe', value: item.amount || '', type: 'text', isDefault: true })
    fields.push({ id: 'currency', key: 'Moneda (ej. EUR, USD)', value: item.currency || 'EUR', type: 'text', isDefault: true })
    fields.push({ id: 'vendor', key: 'Comercio / Vendedor', value: item.vendor || '', type: 'text', isDefault: true })
    fields.push({ id: 'purchaseDate', key: 'Fecha de compra (YYYY-MM-DD)', value: item.purchaseDate || '', type: 'text', isDefault: true })
    fields.push({ id: 'warrantyExpiry', key: 'Fin de garantía (YYYY-MM-DD)', value: item.warrantyExpiry || '', type: 'text', isDefault: true })
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
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { trackItemAccess, localCategories } = useVault()

  const buildCategoryOptions = () => {
    const options: { id: string, label: string, depth: number }[] = []
    const traverse = (parentId: string | null, depth: number) => {
      const children = (localCategories || []).filter(c => (c.parentId || null) === parentId)
      for (const child of children) {
        options.push({ id: child.id, label: child.label, depth })
        traverse(child.id, depth + 1)
      }
    }
    traverse(null, 0)
    return options
  }
  const categoryOptions = buildCategoryOptions()



  const handleItemAccessed = () => {
    if (item.id) {
      void trackItemAccess(item.id)
    }
  }

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
    } else if (finalItem.type === 'INVOICE') {
      finalItem.amount = fields.find((f) => f.id === 'amount')?.value || ''
      finalItem.currency = fields.find((f) => f.id === 'currency')?.value || 'EUR'
      finalItem.vendor = fields.find((f) => f.id === 'vendor')?.value || ''
      finalItem.purchaseDate = fields.find((f) => f.id === 'purchaseDate')?.value || ''
      finalItem.warrantyExpiry = fields.find((f) => f.id === 'warrantyExpiry')?.value || ''
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
    if (isUploadingAttachment) {
      setError('Hay archivos adjuntos subiéndose. Por favor, espera a que terminen.')
      return
    }
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
    <form onSubmit={submit} className="flex w-full flex-col select-none font-sans animate-vault-morph pb-12">
      {/* Sticky Header — Modo Edición / Creación */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border-subtle bg-white/90 px-4 py-3 backdrop-blur-xl dark:bg-[#1c1c1e]/90 lg:px-8 lg:py-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={handleCancelClick} className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover" aria-label="Volver">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-text-primary dark:bg-white/10 dark:text-white">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-6a2.25 2.25 0 00-2.25-2.25h-4.879a2.25 2.25 0 01-1.59-.659L9.659 4.22A2.25 2.25 0 008.069 3.56H6.75A2.25 2.25 0 004.5 5.81v12.44A2.25 2.25 0 006.75 20.5h10.5a2.25 2.25 0 002.25-2.25v-4z" />
            </svg>
          </div>
          <h2 className="truncate text-lg font-bold text-text-primary dark:text-white">
            {item.id.startsWith('draft-') ? 'Añadir elemento' : 'Editar elemento'}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onDelete && !item.id.startsWith('draft-') && (
            <button type="button" onClick={() => void onDelete()} className="hidden sm:block rounded-xl px-4 py-2 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 active:scale-95">
              Eliminar
            </button>
          )}
          <button type="submit" disabled={saving || isUploadingAttachment} title="Guardar cambios" className="flex items-center justify-center gap-1.5 rounded-xl bg-text-primary px-3 py-2.5 sm:px-5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 active:scale-95">
            {saving ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : item.id.startsWith('draft-') ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="hidden sm:inline">Añadir</span>
              </>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-4 space-y-6">
        <section className="rounded-3xl border border-border-subtle bg-white dark:bg-[#1c1c1e] p-5 shadow-subtle">
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

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-secondary">Ubicación (Carpeta)</label>
            <div className="flex items-center gap-2">
              <select
                value={draft.categoryId || ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, categoryId: e.target.value }))}
                className="flex-1 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5 text-sm text-text-primary shadow-subtle outline-none transition-colors focus:border-border focus:ring-1 focus:ring-border/50"
              >
                <option value="">Sin carpeta asignada</option>
                {categoryOptions.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {'\u00A0'.repeat(cat.depth * 4)}{cat.depth > 0 ? '↳ ' : ''}{cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {draft.type === 'DOCUMENT' && (
            <div className="space-y-6 pt-4 border-t border-border-subtle">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-text-primary">Caducidad de este documento</h4>
                  <p className="mt-1 text-xs text-text-secondary">Si tiene fecha de caducidad (como un DNI), se te avisará cuando esté caducado.</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={draft.hasExpiry}
                    onChange={(e) => {
                      const hasExpiry = e.target.checked
                      setDraft((prev) => ({
                        ...prev,
                        hasExpiry,
                        expiryDate: hasExpiry ? ((prev as any).expiryDate || new Date().toISOString().split('T')[0]) : null
                      }))
                    }}
                  />
                  <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-indigo-300"></div>
                </label>
              </div>

              {draft.hasExpiry && (
                <div className="animate-fade-in animate-vault-slide-up">
                  <FormField
                    label="Fecha de expiración"
                    value={(draft as any).expiryDate || ''}
                    onChange={(e) => setDraft((prev) => ({ ...prev, expiryDate: e.target.value }))}
                    placeholder="YYYY-MM-DD"
                  />
                  <p className="mt-1.5 text-[11px] text-text-tertiary">Formato YYYY-MM-DD (ej: 2026-10-31)</p>
                </div>
              )}

              {(draft as any).pastVersions && (draft as any).pastVersions.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">Historial de Versiones Anteriores</h4>
                  {(draft as any).pastVersions.map((pv: any) => (
                    <div key={pv.id} className="rounded-xl border border-black/5 bg-slate-50 p-4 shadow-sm">
                      <div className="flex justify-between text-xs text-text-secondary mb-3">
                        <span className="font-semibold text-text-primary">Versión archivada el {new Date(pv.archivedAt).toLocaleDateString()}</span>
                        <span>{pv.expiryDate ? `Caducaba: ${pv.expiryDate}` : 'Sin caducidad'}</span>
                      </div>
                      <div className="space-y-2">
                        {pv.attachments.map((att: any) => (
                          <div key={att.id} className="flex items-center gap-2 rounded-lg bg-white dark:bg-[#2c2c2e] p-2 border border-black/5 dark:border-white/10 text-xs">
                            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span className="truncate flex-1 font-medium text-text-primary">{att.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {draft.type === 'PAPERWORK' && (
            <div className="space-y-6 pt-4 border-t border-border-subtle">
              <div className="animate-fade-in animate-vault-slide-up">
                <FormField
                  label="Periodo / Año"
                  value={(draft as any).period || ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, period: e.target.value }))}
                  placeholder="ej. 2024 o 2025/2026"
                />
                <p className="mt-1.5 text-[11px] text-text-tertiary">Identificador temporal para el papeleo vigente.</p>
              </div>
            </div>
          )}

      {draft.type === 'DOCUMENT' && (
        <div className="space-y-6 pt-4 border-t border-border-subtle">
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-text-primary">Tipo de Documento Legal</h3>
            <select
              value={(draft as any).documentTemplate || 'CUSTOM'}
              onChange={(e) => setDraft(prev => ({ ...prev, documentTemplate: e.target.value as any }))}
              className="w-full rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5 text-sm text-text-primary shadow-subtle outline-none transition-colors focus:border-border focus:ring-1 focus:ring-border/50"
            >
              <option value="DNI">DNI / Documento Nacional de Identidad</option>
              <option value="PASSPORT">Pasaporte</option>
              <option value="DRIVING_LICENSE">Carnet de Conducir</option>
              <option value="CUSTOM">Documento Genérico / Personalizado</option>
            </select>
            <div className="mt-3 text-xs text-text-secondary">
              {(draft as any).documentTemplate === 'DNI' && <p>👉 <strong>Obligatorio:</strong> Adjunta una foto de la <strong>parte delantera</strong> y otra de la <strong>parte trasera</strong> del DNI.</p>}
              {(draft as any).documentTemplate === 'PASSPORT' && <p>👉 <strong>Obligatorio:</strong> Adjunta una foto de la <strong>página principal</strong> con tus datos y foto.</p>}
              {(draft as any).documentTemplate === 'DRIVING_LICENSE' && <p>👉 <strong>Obligatorio:</strong> Adjunta una foto de la <strong>parte delantera</strong> y otra de la <strong>parte trasera</strong> del carnet.</p>}
              {(!(draft as any).documentTemplate || (draft as any).documentTemplate === 'CUSTOM') && <p>Adjunta cualquier archivo PDF o imagen relacionada con este documento.</p>}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 mb-6">
        <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-5 shadow-sm">
          <AttachmentsList
            attachments={draft.attachments || []}
            onAttachmentsChange={(attachments) => setDraft(prev => ({ ...prev, attachments }))}
            onUploadingChange={setIsUploadingAttachment}
            templateType={draft.type === 'DOCUMENT' ? (draft as any).documentTemplate : undefined}
          />

          {['DOCUMENT', 'PAPERWORK'].includes(draft.type) && item.id && (
            <div className="mt-6 border-t border-black/5 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-text-primary">¿El documento ha caducado o sido renovado?</h4>
                  <p className="text-[10px] text-text-secondary mt-0.5">Archiva la versión actual para subir una nueva.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const isPaperwork = draft.type === 'PAPERWORK';
                    if (!window.confirm(`¿Quieres archivar las fotos actuales y ${isPaperwork ? 'el periodo' : 'la fecha de caducidad'} en el historial para subir las nuevas?`)) return;
                    setDraft(prev => {
                      const past = (prev as any).pastVersions || [];
                      const newPast = [{
                        id: `archived-${Date.now()}`,
                        attachments: prev.attachments || [],
                        ...(isPaperwork ? { period: (prev as any).period || '' } : { expiryDate: (prev as any).expiryDate || null }),
                        replacedAt: new Date().toISOString()
                      }, ...past];
                      return {
                        ...prev,
                        attachments: [],
                        ...(isPaperwork ? { period: '' } : { expiryDate: null }),
                        pastVersions: newPast
                      };
                    });
                  }}
                  className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100"
                >
                  Renovar {draft.type === 'PAPERWORK' ? 'Trámite' : 'Documento'}
                </button>
              </div>

              {(draft as any).pastVersions?.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">Versiones Anteriores ({(draft as any).pastVersions.length})</h4>
                  <ul className="space-y-2">
                    {(draft as any).pastVersions.map((version: any) => (
                      <li key={version.id} className="rounded-xl border border-black/5 bg-white p-3 shadow-sm opacity-80">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-text-secondary">
                            Archivado el {new Date(version.replacedAt).toLocaleDateString()}
                          </span>
                          {(version.expiryDate || version.period) && (
                            <span className="text-[10px] text-text-tertiary">
                              {version.expiryDate ? `Caducaba: ${new Date(version.expiryDate).toLocaleDateString()}` : `Periodo: ${version.period}`}
                            </span>
                          )}
                        </div>
                        <AttachmentsList
                          attachments={version.attachments || []}
                          readOnly
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
                          onAccess={handleItemAccessed}
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
                <div className="rounded-xl bg-white dark:bg-slate-800 p-3 shadow-sm ring-1 ring-red-100 dark:ring-red-500/30">
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

                <div className="rounded-xl bg-white dark:bg-slate-800 p-3 shadow-sm ring-1 ring-red-100 dark:ring-red-500/30">
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

      </div>
    </form>
  )
}

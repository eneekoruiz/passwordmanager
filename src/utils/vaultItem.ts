import type {
  LocalCategory,
  LocalVaultItem,
  LocalVaultItemType,
  VaultItem,
  WifiSecurityType,
} from '../types'
import { generateId } from './id'

function nowIso(): string {
  return new Date().toISOString()
}

export const LOCAL_ITEM_LABELS: Record<LocalVaultItemType, string> = {
  WIFI: 'Wi-Fi',
  SOFTWARE_LICENSE: 'Licencias',
  FINANCE: 'Finanzas',
  SECURE_NOTE: 'Notas seguras',
  DOCUMENT: 'Documentos',
}

export const PRESET_LOCAL_CATEGORIES: LocalCategory[] = [
  { id: 'preset-documents', label: 'Documentación (DNI, etc.)', type: 'DOCUMENT', custom: true },
  { id: 'preset-academic', label: 'Académico', type: 'SECURE_NOTE', custom: true },
  { id: 'preset-work', label: 'Trabajo', type: 'SECURE_NOTE', custom: true },
  { id: 'preset-personal', label: 'Personal', type: 'SECURE_NOTE', custom: true },
  { id: 'preset-health', label: 'Salud', type: 'SECURE_NOTE', custom: true },
  { id: 'preset-travel', label: 'Viajes', type: 'SECURE_NOTE', custom: true },
]

export function normalizeLocalCategory(category: LocalCategory): LocalCategory {
  const now = nowIso()
  return {
    id: category.id,
    label: category.label.trim(),
    type: category.type || 'SECURE_NOTE',
    custom: Boolean(category.custom),
    createdAt: category.createdAt ?? now,
    updatedAt: category.updatedAt ?? now,
  }
}

export function createLocalVaultItem(
  type: LocalVaultItemType,
  categoryId: string = type,
  categoryLabel: string = LOCAL_ITEM_LABELS[type],
): LocalVaultItem {
  const now = nowIso()
  const base = {
    id: generateId(),
    type,
    title: '',
    categoryId,
    categoryLabel,
    createdAt: now,
    updatedAt: now,
  }

  switch (type) {
    case 'WIFI':
      return {
        ...base,
        type: 'WIFI',
        ssid: '',
        password: null,
        securityType: 'WPA2',
      }
    case 'SOFTWARE_LICENSE':
      return {
        ...base,
        type: 'SOFTWARE_LICENSE',
        softwareName: '',
        licenseKey: '',
      }
    case 'FINANCE':
      return {
        ...base,
        type: 'FINANCE',
        cardNumber: '',
        pin: null,
        cvv: null,
        expiry: null,
      }
    case 'SECURE_NOTE':
      return { ...base, type: 'SECURE_NOTE', markdown: '' }
    case 'DOCUMENT':
      return { 
        ...base, 
        type: 'DOCUMENT', 
        hasExpiry: false, 
        expiryDate: null, 
        pastVersions: [],
        documentTemplate: 'CUSTOM' 
      }
    default:
      return base as any
  }
}

export function normalizeLocalVaultItem(item: LocalVaultItem): LocalVaultItem {
  const updatedAt = new Date().toISOString()
  const categoryId = item.categoryId ?? item.type
  const categoryLabel = item.categoryLabel?.trim() || LOCAL_ITEM_LABELS[item.type]

  const customFields =
    item.customFields
      ?.filter((field) => field.key.trim() || field.value.trim())
      .map((field) => ({
        id: field.id || generateId(),
        key: field.key.trim(),
        value: field.value.trim(),
        protected: Boolean(field.protected),
        type: field.type || undefined,
        options: field.options || undefined,
      })) ?? []

  switch (item.type) {
    case 'WIFI':
      return {
        ...item,
        categoryId,
        categoryLabel,
        title: (item.title || item.ssid || 'Red Wi-Fi').trim(),
        ssid: item.ssid.trim(),
        password: item.password?.trim() || null,
        securityType: item.securityType || 'WPA2',
        customFields: customFields.length > 0 ? customFields : undefined,
        updatedAt,
      }
    case 'SOFTWARE_LICENSE':
      return {
        ...item,
        categoryId,
        categoryLabel,
        title: (item.title || item.softwareName || 'Licencia').trim(),
        softwareName: item.softwareName.trim(),
        licenseKey: item.licenseKey.trim(),
        customFields: customFields.length > 0 ? customFields : undefined,
        updatedAt,
      }
    case 'FINANCE':
      return {
        ...item,
        categoryId,
        categoryLabel,
        title: (item.title || 'Tarjeta').trim(),
        cardNumber: item.cardNumber.trim(),
        pin: item.pin?.trim() || null,
        cvv: item.cvv?.trim() || null,
        expiry: item.expiry?.trim() || null,
        customFields: customFields.length > 0 ? customFields : undefined,
        updatedAt,
      }
    case 'SECURE_NOTE':
      return {
        ...item,
        categoryId,
        categoryLabel,
        title: (item.title || 'Nota segura').trim(),
        markdown: item.markdown.trim(),
        customFields: customFields.length > 0 ? customFields : undefined,
        updatedAt,
      }
    case 'DOCUMENT':
      return {
        ...item,
        categoryId,
        categoryLabel,
        title: (item.title || 'Documento').trim(),
        hasExpiry: Boolean(item.hasExpiry),
        expiryDate: item.expiryDate ?? null,
        pastVersions: item.pastVersions || [],
        attachments: item.attachments || [],
        customFields: customFields.length > 0 ? customFields : undefined,
        updatedAt,
      }
  }
}

export function isLocalVaultItem(value: unknown): value is LocalVaultItem {
  if (typeof value !== 'object' || value === null) return false
  const type = (value as { type?: unknown }).type
  return (
    type === 'WIFI' ||
    type === 'SOFTWARE_LICENSE' ||
    type === 'FINANCE' ||
    type === 'SECURE_NOTE' ||
    type === 'DOCUMENT'
  )
}

export function normalizeUnknownLocalVaultItem(value: unknown): LocalVaultItem | null {
  if (!isLocalVaultItem(value)) return null
  return normalizeLocalVaultItem({
    ...createLocalVaultItem(value.type),
    ...value,
  } as LocalVaultItem)
}

export function vaultItemDisplayName(item: VaultItem): string {
  if (item.type === 'ACCOUNT') return item.name || item.title || 'Cuenta'
  if (item.type === 'WIFI') return item.ssid || item.title || 'Red Wi-Fi'
  if (item.type === 'SOFTWARE_LICENSE') return item.softwareName || item.title || 'Licencia'
  if (item.type === 'FINANCE') return item.title || 'Tarjeta'
  if (item.type === 'DOCUMENT') return item.title || 'Documento'
  return item.title || 'Nota segura'
}

export const WIFI_SECURITY_OPTIONS: WifiSecurityType[] = ['WPA2', 'WPA3', 'WEP', 'OPEN', 'OTHER']

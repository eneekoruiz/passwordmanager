import type {
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
}

export function createLocalVaultItem(type: LocalVaultItemType, categoryId: string = type): LocalVaultItem {
  const now = nowIso()
  const base = {
    id: generateId(),
    type,
    title: '',
    categoryId,
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
      return {
        ...base,
        type: 'SECURE_NOTE',
        markdown: '',
      }
  }
}

export function normalizeLocalVaultItem(item: LocalVaultItem): LocalVaultItem {
  const updatedAt = new Date().toISOString()

  switch (item.type) {
    case 'WIFI':
      return {
        ...item,
        title: (item.title || item.ssid || 'Red Wi-Fi').trim(),
        ssid: item.ssid.trim(),
        password: item.password?.trim() || null,
        securityType: item.securityType || 'WPA2',
        updatedAt,
      }
    case 'SOFTWARE_LICENSE':
      return {
        ...item,
        title: (item.title || item.softwareName || 'Licencia').trim(),
        softwareName: item.softwareName.trim(),
        licenseKey: item.licenseKey.trim(),
        updatedAt,
      }
    case 'FINANCE':
      return {
        ...item,
        title: (item.title || 'Tarjeta').trim(),
        cardNumber: item.cardNumber.trim(),
        pin: item.pin?.trim() || null,
        cvv: item.cvv?.trim() || null,
        expiry: item.expiry?.trim() || null,
        updatedAt,
      }
    case 'SECURE_NOTE':
      return {
        ...item,
        title: (item.title || 'Nota segura').trim(),
        markdown: item.markdown.trim(),
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
    type === 'SECURE_NOTE'
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
  return item.title || 'Nota segura'
}

export const WIFI_SECURITY_OPTIONS: WifiSecurityType[] = ['WPA2', 'WPA3', 'WEP', 'OPEN', 'OTHER']

import type { SyncDiffResult, VaultDiffItem, VaultItemType, BaseVaultItem } from '../types'
import { deterministicStringify } from './hash'
import { LOCAL_IDENTITY_EMAIL } from './identity'

type PayloadItem = BaseVaultItem & { [key: string]: any }

/**
 * Extrae un título legible para la UI del Diff Modal según el tipo de dato.
 *
 * - Identity: muestra el email y número de plataformas.
 * - LocalVaultItem: usa `title`, `ssid`, `softwareName`, etc.
 * - LocalCategory: usa `label`.
 */
function extractDiffTitle(item: any, type: VaultItemType | 'CATEGORY'): string {
  // Identity: tiene email + platforms[]
  if (type === 'ACCOUNT' && item.email && Array.isArray(item.platforms)) {
    const platformCount = item.platforms.length
    const platformNames = item.platforms
      .slice(0, 3)
      .map((p: any) => p.name || p.title || '')
      .filter(Boolean)
      .join(', ')
    if (platformNames) {
      return `${item.email} (${platformNames}${platformCount > 3 ? ` +${platformCount - 3}` : ''})`
    }
    return item.email
  }

  // Category
  if (type === 'CATEGORY') {
    return item.label || item.name || 'Sección sin nombre'
  }

  // LocalVaultItem (WIFI, SOFTWARE_LICENSE, FINANCE, SECURE_NOTE)
  if (item.title && item.title.trim()) return item.title
  if (item.ssid) return item.ssid
  if (item.softwareName) return item.softwareName
  if (item.cardNumber) return `Tarjeta •••• ${item.cardNumber.slice(-4)}`
  if (item.name && item.name.trim()) return item.name

  return 'Elemento sin nombre'
}

/**
 * Extrae un subtítulo informativo para cada fila del Diff.
 */
function extractDiffSubtitle(item: any, type: VaultItemType | 'CATEGORY'): string {
  if (type === 'ACCOUNT' && Array.isArray(item.platforms)) {
    return `${item.platforms.length} plataforma${item.platforms.length !== 1 ? 's' : ''}`
  }
  if (type === 'CATEGORY') {
    return item.type || 'Sección'
  }
  if (item.type === 'WIFI') return `Red WiFi · ${item.securityType || 'Abierta'}`
  if (item.type === 'SOFTWARE_LICENSE') return 'Licencia de Software'
  if (item.type === 'FINANCE') return `Finanzas · ${item.expiry || 'Sin vencimiento'}`
  if (item.type === 'SECURE_NOTE') return 'Nota Segura'
  return item.type?.replace('_', ' ') || 'Credencial'
}

export function computeSyncDiff(
  localIdentities: any[],
  localItems: any[],
  localCategories: any[],
  cloudIdentities: any[],
  cloudItems: any[],
  cloudCategories: any[]
): SyncDiffResult {
  const diffs: VaultDiffItem[] = []
  let hasChanges = false

  const compareArrays = (
    localArr: PayloadItem[],
    cloudArr: PayloadItem[],
    typeMapper: (item: any) => VaultItemType | 'CATEGORY'
  ) => {
    const localMap = new Map(localArr.map(i => [i.id, i]))
    const cloudMap = new Map(cloudArr.map(i => [i.id, i]))

    for (const [id, localItem] of localMap.entries()) {
      const cloudItem = cloudMap.get(id)
      const itemType = typeMapper(localItem)
      
      if (!cloudItem) {
        diffs.push({
          id,
          title: extractDiffTitle(localItem, itemType),
          subtitle: extractDiffSubtitle(localItem, itemType),
          type: itemType as VaultItemType,
          status: 'deleted',
          localUpdatedAt: localItem.updatedAt,
          localData: localItem
        })
        hasChanges = true
      } else {
        const localStr = deterministicStringify(localItem)
        const cloudStr = deterministicStringify(cloudItem)
        if (localStr !== cloudStr) {
          diffs.push({
            id,
            title: extractDiffTitle(cloudItem, itemType),
            subtitle: extractDiffSubtitle(cloudItem, itemType),
            type: itemType as VaultDiffItem['type'],
            status: 'conflict',
            localUpdatedAt: localItem.updatedAt,
            cloudUpdatedAt: cloudItem.updatedAt,
            localData: localItem,
            cloudData: cloudItem
          })
          hasChanges = true
        }
      }
    }

    for (const [id, cloudItem] of cloudMap.entries()) {
      if (!localMap.has(id)) {
        const itemType = typeMapper(cloudItem)
        diffs.push({
          id,
          title: extractDiffTitle(cloudItem, itemType),
          subtitle: extractDiffSubtitle(cloudItem, itemType),
          type: itemType as VaultItemType,
          status: 'added',
          cloudUpdatedAt: cloudItem.updatedAt,
          cloudData: cloudItem
        })
        hasChanges = true
      }
    }
  }

  compareArrays(localIdentities, cloudIdentities, () => 'ACCOUNT')
  compareArrays(localItems, cloudItems, (item) => item.type || 'SECURE_NOTE')
  compareArrays(localCategories, cloudCategories, () => 'CATEGORY' as any)

  // Post-procesamiento para agrupar "Cuentas Locales"
  const emailDiffs: VaultDiffItem[] = []
  const localGroupDiffs: VaultDiffItem[] = []

  for (const diff of diffs) {
    const isLocalNonEmail =
      (diff.type as string) === 'CATEGORY' ||
      diff.type === 'WIFI' ||
      diff.type === 'SOFTWARE_LICENSE' ||
      diff.type === 'FINANCE' ||
      diff.type === 'SECURE_NOTE' ||
      (diff.type === 'ACCOUNT' && (
        diff.title === LOCAL_IDENTITY_EMAIL ||
        (diff.localData && diff.localData.email === LOCAL_IDENTITY_EMAIL) ||
        (diff.cloudData && diff.cloudData.email === LOCAL_IDENTITY_EMAIL)
      ))

    if (isLocalNonEmail) {
      localGroupDiffs.push(diff)
    } else {
      emailDiffs.push(diff)
    }
  }

  if (localGroupDiffs.length > 0) {
    const added = localGroupDiffs.filter(d => d.status === 'added').length
    const modified = localGroupDiffs.filter(d => d.status === 'modified').length
    const deleted = localGroupDiffs.filter(d => d.status === 'deleted').length

    const status = deleted > 0 ? 'deleted' : (modified > 0 ? 'modified' : 'added')

    const cloudTimes = localGroupDiffs.map(d => d.cloudUpdatedAt ? Date.parse(d.cloudUpdatedAt) : 0).filter(Boolean)
    const localTimes = localGroupDiffs.map(d => d.localUpdatedAt ? Date.parse(d.localUpdatedAt) : 0).filter(Boolean)

    const maxCloudTime = cloudTimes.length > 0 ? Math.max(...cloudTimes) : undefined
    const maxLocalTime = localTimes.length > 0 ? Math.max(...localTimes) : undefined

    const details: string[] = []
    if (added > 0) details.push(`${added} nuevo${added !== 1 ? 's' : ''}`)
    if (modified > 0) details.push(`${modified} modificado${modified !== 1 ? 's' : ''}`)
    if (deleted > 0) details.push(`${deleted} solo local${deleted !== 1 ? 'es' : ''}`)

    const subtitle = details.join(', ') || 'Sin cambios'

    const groupedDiffItem: VaultDiffItem = {
      id: 'Cuentas Locales',
      title: 'Cuentas Locales',
      subtitle,
      type: 'ACCOUNT', // Tratado como cuenta para renderizar adecuadamente
      status,
      cloudUpdatedAt: maxCloudTime ? new Date(maxCloudTime).toISOString() : undefined,
      localUpdatedAt: maxLocalTime ? new Date(maxLocalTime).toISOString() : undefined,
    }

    emailDiffs.push(groupedDiffItem)
  }

  return {
    hasChanges,
    diffs: emailDiffs,
    cloudIdentities,
    cloudLocalItems: cloudItems
  }
}

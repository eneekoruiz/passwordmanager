import type { SyncDiffResult, VaultDiffItem, VaultItemType, BaseVaultItem } from '../types'
import { deterministicStringify } from './hash'

type PayloadItem = BaseVaultItem & { [key: string]: any }

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
      
      if (!cloudItem) {
        diffs.push({
          id,
          title: localItem.title || localItem.name || localItem.label || 'Sin título',
          type: typeMapper(localItem) as VaultItemType,
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
            title: cloudItem.title || cloudItem.name || cloudItem.label || 'Sin título',
            type: typeMapper(cloudItem) as VaultItemType,
            status: 'modified',
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
        diffs.push({
          id,
          title: cloudItem.title || cloudItem.name || cloudItem.label || 'Sin título',
          type: typeMapper(cloudItem) as VaultItemType,
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

  return {
    hasChanges,
    diffs,
    cloudIdentities,
    cloudLocalItems: cloudItems
  }
}

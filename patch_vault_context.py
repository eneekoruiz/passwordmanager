with open('src/context/VaultContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = """        const localHasVaultData =
          localCounts.platformCount > 0 ||
          localCounts.localItemCount > 0 ||
          localCounts.localCategoryCount > 0
        const cloudHasVaultData =
          cloudSummary.platformCount > 0 ||
          cloudSummary.localItemCount > 0 ||
          cloudSummary.localCategoryCount > 0
        const cloudLooksNewer = cloudUpdatedAt > localUpdatedAt + 1000
        const localLooksEmpty = !localHasVaultData && cloudHasVaultData
        const cloudHasMoreData =
          cloudSummary.platformCount > localCounts.platformCount ||
          cloudSummary.localItemCount > localCounts.localItemCount ||
          cloudSummary.localCategoryCount > localCounts.localCategoryCount

        if (cloudLooksNewer || localLooksEmpty || cloudHasMoreData) {"""

replacement = """        const localHasVaultData =
          localCounts.platformCount > 0 ||
          localCounts.localItemCount > 0 ||
          localCounts.localCategoryCount > 0
        const cloudHasVaultData =
          cloudSummary.platformCount > 0 ||
          cloudSummary.localItemCount > 0 ||
          cloudSummary.localCategoryCount > 0
        const cloudLooksNewer = cloudUpdatedAt > localUpdatedAt + 1000
        const localLooksEmpty = !localHasVaultData && cloudHasVaultData
        const cloudHasMoreData =
          cloudSummary.platformCount > localCounts.platformCount ||
          cloudSummary.localItemCount > localCounts.localItemCount ||
          cloudSummary.localCategoryCount > localCounts.localCategoryCount

        if (cloudLooksNewer || localLooksEmpty || cloudHasMoreData || !isIdentical) {
          const decryptedCloud = await storeRef.current.inspectAndDecryptCloudPayload(cloudBlob)
          const localIdns = await storeRef.current.loadAllIdentities(currentProfileId)
          const localIts = await storeRef.current.loadLocalItems(currentProfileId)
          const localCats = await storeRef.current.loadLocalCategories(currentProfileId)
          const { computeSyncDiff } = await import('../utils/syncDiff')
          const diffResult = computeSyncDiff(
            localIdns, localIts, localCats,
            decryptedCloud.identities, decryptedCloud.localItems, decryptedCloud.localCategories
          )
"""

if target in content:
    new_content = content.replace(target, replacement)
    # Also add diffResult to the return object
    target2 = "            localLocalCategoryCount: localCounts.localCategoryCount,\n          }"
    replacement2 = "            localLocalCategoryCount: localCounts.localCategoryCount,\n            diffResult,\n          }"
    new_content = new_content.replace(target2, replacement2)
    with open('src/context/VaultContext.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Patched VaultContext.tsx successfully")
else:
    print("Target not found in VaultContext.tsx")

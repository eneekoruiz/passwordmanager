import type { SyncDiffResult } from '../types'

export type SyncDecision = 'synced' | 'auto_download' | 'upload' | 'diff_required'

export interface CloudSyncDecisionInput {
  isIdentical: boolean
  localHasVaultData: boolean
  cloudHasVaultData: boolean
  cloudUpdatedAt: number
  localUpdatedAt: number
  lastSyncedCloudAt: number
  lastLocalMutationAt: number
  cloudHasMoreData: boolean
}

const SYNC_CLOCK_SKEW_MS = 1000

/**
 * Decides the safe cloud synchronization action using bidirectional timestamps and content parity.
 * Prevents local mutations or intentional deletions from being overwritten or resurrected by stale cloud state.
 */
export function decideCloudSyncAction(
  input: CloudSyncDecisionInput,
  computeDiff?: () => SyncDiffResult,
): { action: SyncDecision; diffResult?: SyncDiffResult } {
  const {
    isIdentical,
    localHasVaultData,
    cloudHasVaultData,
    cloudUpdatedAt,
    localUpdatedAt,
    lastSyncedCloudAt,
    lastLocalMutationAt,
    cloudHasMoreData,
  } = input

  if (isIdentical) {
    return { action: 'synced' }
  }

  const deletedLocallyAfterCloud =
    lastSyncedCloudAt > 0 && lastLocalMutationAt > cloudUpdatedAt

  if (!localHasVaultData && cloudHasVaultData) {
    return { action: deletedLocallyAfterCloud ? 'upload' : 'auto_download' }
  }

  // When this device has an explicit baseline matching the current cloud version,
  // every delta originates locally and must upload cleanly instead of treating new items as downloads.
  const cloudUnchangedSinceLastSync =
    lastSyncedCloudAt > 0 && cloudUpdatedAt <= lastSyncedCloudAt + SYNC_CLOCK_SKEW_MS

  if (cloudUnchangedSinceLastSync && !cloudHasMoreData) {
    return { action: 'upload' }
  }

  if (cloudUnchangedSinceLastSync && cloudHasMoreData && lastLocalMutationAt > lastSyncedCloudAt) {
    return { action: 'upload' }
  }

  const cloudLooksNewer = cloudUpdatedAt > localUpdatedAt + SYNC_CLOCK_SKEW_MS
  if (cloudLooksNewer || cloudHasMoreData || !isIdentical) {
    const diffResult = computeDiff?.()
    if (diffResult && !diffResult.hasChanges) {
      return { action: 'synced' }
    }

    if (
      diffResult &&
      diffResult.diffs.length > 0 &&
      diffResult.diffs.every((d) => d.status === 'deleted') &&
      lastLocalMutationAt > cloudUpdatedAt
    ) {
      return { action: 'upload' }
    }

    return { action: 'diff_required', diffResult }
  }

  return { action: 'upload' }
}

/**
 * Builds Last-Write-Wins resolutions for automatic boot reconciliation without wiping unsynced local additions.
 */
export function buildAutoBootResolutions(
  diffResult: SyncDiffResult,
): Record<string, 'local' | 'cloud' | 'local_only'> | undefined {
  if (!diffResult.diffs.length) return undefined

  const hasLocalChangesOrConflicts = diffResult.diffs.some(
    (d) => d.status === 'conflict' || d.status === 'deleted',
  )
  if (!hasLocalChangesOrConflicts) {
    return undefined
  }

  const resolutions: Record<string, 'local' | 'cloud' | 'local_only'> = {}
  for (const diff of diffResult.diffs) {
    if (diff.status === 'conflict') {
      const localTime = diff.localUpdatedAt ? Date.parse(diff.localUpdatedAt) || 0 : 0
      const cloudTime = diff.cloudUpdatedAt ? Date.parse(diff.cloudUpdatedAt) || 0 : 0
      resolutions[diff.id] = localTime >= cloudTime ? 'local' : 'cloud'
    } else if (diff.status === 'deleted') {
      // "deleted" in computeSyncDiff denotes items present locally and not yet in cloud
      resolutions[diff.id] = 'local'
    }
  }
  return resolutions
}

import { describe, expect, it } from 'vitest'
import type { SyncDiffResult } from '../types'
import { buildAutoBootResolutions, decideCloudSyncAction } from './syncPolicy'

describe('syncPolicy', () => {
  it('uploads new local notes when cloud vault is unchanged since last sync', () => {
    const decision = decideCloudSyncAction({
      isIdentical: false,
      localHasVaultData: true,
      cloudHasVaultData: true,
      cloudUpdatedAt: 1000,
      localUpdatedAt: 2500,
      lastSyncedCloudAt: 1000,
      lastLocalMutationAt: 2500,
      cloudHasMoreData: false,
    })

    expect(decision.action).toBe('upload')
  })

  it('uploads intentional deletion of the last item instead of resurrecting from cloud', () => {
    const decision = decideCloudSyncAction({
      isIdentical: false,
      localHasVaultData: false,
      cloudHasVaultData: true,
      cloudUpdatedAt: 1000,
      localUpdatedAt: 3000,
      lastSyncedCloudAt: 1000,
      lastLocalMutationAt: 3000,
      cloudHasMoreData: true,
    })

    expect(decision.action).toBe('upload')
  })

  it('auto-downloads on a fresh uninitialized device with empty local storage', () => {
    const decision = decideCloudSyncAction({
      isIdentical: false,
      localHasVaultData: false,
      cloudHasVaultData: true,
      cloudUpdatedAt: 5000,
      localUpdatedAt: 0,
      lastSyncedCloudAt: 0,
      lastLocalMutationAt: 0,
      cloudHasMoreData: true,
    })

    expect(decision.action).toBe('auto_download')
  })

  it('uploads when upgrading from missing sync cursor if diffs are strictly local additions made after cloud snapshot', () => {
    const fakeDiff: SyncDiffResult = {
      hasChanges: true,
      cloudIdentities: [],
      cloudLocalItems: [],
      diffs: [
        {
          id: 'note-new',
          title: 'Mi nota privada',
          subtitle: 'Nota Segura',
          type: 'SECURE_NOTE',
          status: 'deleted', // computeSyncDiff status for local-only unsynced item
          localUpdatedAt: new Date(3000).toISOString(),
        },
      ],
    }

    const decision = decideCloudSyncAction(
      {
        isIdentical: false,
        localHasVaultData: true,
        cloudHasVaultData: true,
        cloudUpdatedAt: 1000,
        localUpdatedAt: 3000,
        lastSyncedCloudAt: 0,
        lastLocalMutationAt: 3000,
        cloudHasMoreData: false,
      },
      () => fakeDiff,
    )

    expect(decision.action).toBe('upload')
  })

  it('preserves local additions and applies LWW resolutions on automatic boot reconciliation', () => {
    const diff: SyncDiffResult = {
      hasChanges: true,
      cloudIdentities: [],
      cloudLocalItems: [],
      diffs: [
        {
          id: 'note-local',
          title: 'Nueva nota local',
          subtitle: 'Nota Segura',
          type: 'SECURE_NOTE',
          status: 'deleted',
          localUpdatedAt: '2026-11-24T12:00:00.000Z',
        },
        {
          id: 'note-conflict-cloud-newer',
          title: 'Nota conflictiva',
          subtitle: 'Nota Segura',
          type: 'SECURE_NOTE',
          status: 'conflict',
          localUpdatedAt: '2026-11-24T10:00:00.000Z',
          cloudUpdatedAt: '2026-11-24T11:00:00.000Z',
        },
      ],
    }

    const resolutions = buildAutoBootResolutions(diff)
    expect(resolutions).toEqual({
      'note-local': 'local',
      'note-conflict-cloud-newer': 'cloud',
    })
  })
})

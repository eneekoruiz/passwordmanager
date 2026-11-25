import { describe, expect, it } from 'vitest'
import { CryptoVault } from '../crypto/CryptoVault'
import { createLocalVaultItem, normalizeLocalCategory } from '../utils/vaultItem'
import { VaultStore } from './VaultStore'

describe('VaultStore isLocalOnly preservation', { timeout: 90_000 }, () => {
  it('preserves local-only private notes and categories during cloud payload restore', async () => {
    const vault = new CryptoVault()
    const store = new VaultStore(vault)
    const masterPassword = 'StrongTestPassword123!'

    const profileId = await store.createProfile('Bóveda Principal', masterPassword, 'uno dos tres')
    expect(await store.unlockProfile(profileId, masterPassword)).toBe(true)

    const syncedNote = {
      ...createLocalVaultItem('SECURE_NOTE', 'SECURE_NOTE', 'Notas seguras'),
      title: 'Nota Nube',
      markdown: 'Texto inicial en nube',
      isLocalOnly: false,
    }
    await store.saveLocalItem(profileId, syncedNote)

    // Export cloud snapshot BEFORE creating a strictly local-only note
    const cloudBlob = await store.exportCloudPayload(profileId)

    const localOnlyNote = {
      ...createLocalVaultItem('SECURE_NOTE', 'SECURE_NOTE', 'Notas seguras'),
      title: 'Nota Secreta Local',
      markdown: 'Nunca subir a Firebase',
      isLocalOnly: true,
    }
    const localOnlyCat = normalizeLocalCategory({
      id: 'cat-local-secret',
      label: 'Solo Dispositivo',
      type: 'SECURE_NOTE',
      custom: true,
      isLocalOnly: true,
    })
    await store.saveLocalItem(profileId, localOnlyNote)
    await store.saveLocalCategory(profileId, localOnlyCat)

    await store.restoreCloudPayloadWithActiveSession(profileId, cloudBlob)

    const restoredItems = await store.loadLocalItems(profileId)
    const restoredCats = await store.loadLocalCategories(profileId)

    expect(restoredItems.some((item) => item.id === syncedNote.id)).toBe(true)
    expect(restoredItems.some((item) => item.id === localOnlyNote.id && item.isLocalOnly === true)).toBe(true)
    expect(restoredCats.some((cat) => cat.id === localOnlyCat.id && cat.isLocalOnly === true)).toBe(true)

    // Also verify locked restoreCloudPayload preserves local-only items and categories
    vault.lock()
    await store.restoreCloudPayload(profileId, cloudBlob, masterPassword)
    expect(await store.unlockProfile(profileId, masterPassword)).toBe(true)

    const unlockedAfterLockedRestore = await store.loadLocalItems(profileId)
    const catsAfterLockedRestore = await store.loadLocalCategories(profileId)
    expect(unlockedAfterLockedRestore.some((item) => item.id === localOnlyNote.id && item.isLocalOnly === true)).toBe(
      true,
    )
    expect(catsAfterLockedRestore.some((cat) => cat.id === localOnlyCat.id && cat.isLocalOnly === true)).toBe(true)
  })
})

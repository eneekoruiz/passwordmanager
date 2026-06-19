import { describe, expect, it } from 'vitest'

import { CryptoVault } from './CryptoVault'
import { base64ToBytes } from './encoding'

describe('CryptoVault', () => {
  it('encrypts and decrypts JSON with the active session key', async () => {
    const vault = new CryptoVault()
    const salt = CryptoVault.generateSalt()
    await vault.unlock('correct horse battery staple', salt)
    const encrypted = await vault.encryptJson({ service: 'example', password: 'secret' })
    expect(await vault.decryptJson(encrypted)).toEqual({ service: 'example', password: 'secret' })
  })

  it('rejects a wrong master password', async () => {
    const { metadata, encryptedPayload } = await CryptoVault.createEncryptedVault(
      'correct password',
      { marker: true },
    )
    await expect(
      CryptoVault.verifyMasterPassword('wrong password', base64ToBytes(metadata.salt), encryptedPayload),
    ).resolves.toBe(false)
  })

  it('detects authenticated-ciphertext tampering', async () => {
    const salt = CryptoVault.generateSalt()
    const key = await CryptoVault.deriveKey('master password', salt)
    const encrypted = await CryptoVault.encryptBytes(new Uint8Array([1, 2, 3]), key)
    const tampered = { ...encrypted, data: encrypted.data.slice(0, -2) + 'AA' }
    await expect(CryptoVault.decryptBytes(tampered, key)).rejects.toThrow()
  })
})
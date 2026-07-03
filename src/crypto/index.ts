export { CryptoVault } from './CryptoVault'
export {
  AES_ALGORITHM,
  AES_KEY_LENGTH_BITS,
  CRYPTO_PROTOCOL_VERSION,
  GCM_IV_LENGTH_BYTES,
  PBKDF2_HASH,
  PBKDF2_ITERATIONS,
  SALT_LENGTH_BYTES,
} from './constants'
export { bytesToBase64, base64ToBytes, stringToBytes, bytesToString } from './encoding'
export type { EncryptedPayload, VaultMetadata, CryptoProtocolVersion } from './types'
export {
  isHardwareKeyAvailable,
  registerHardwareKeyCredential,
  unlockWithHardwareKey
} from './hardwareKey'
export type { HardwareKeyBundle } from './hardwareKey'
export * from './asymmetric'
export * from './symmetric'

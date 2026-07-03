/** Versión del formato de payload cifrado; permite migraciones futuras sin romper bóvedas existentes. */
export type CryptoProtocolVersion = 1

/**
 * Blob cifrado listo para persistir (localStorage, IndexedDB, servidor).
 * Solo contiene material cifrado y el IV; nunca incluye la contraseña maestra
 * ni la clave derivada en texto plano.
 */
export interface EncryptedPayload {
  v: CryptoProtocolVersion
  /** IV único por operación de cifrado (Base64, 12 bytes). */
  iv: string
  /** Ciphertext + tag de autenticación GCM (Base64). */
  data: string
}

export interface RecoveryBundle {
  salt: string
  encryptedMasterPassword: EncryptedPayload
  createdAt: string
}

export interface AsymmetricKeyBundle {
  publicKey: string
  privateKey: EncryptedPayload
}

/**
 * Metadatos de bóveda almacenables en persistencia.
 * El salt es público: su función es impedir ataques con tablas precalculadas (rainbow tables),
 * no es un secreto que deba ocultarse.
 */
export interface VaultMetadata {
  salt: string
  createdAt: string
  asymmetricKeys?: AsymmetricKeyBundle
}

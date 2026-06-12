/**
 * PBKDF2 con SHA-256 y 600.000 iteraciones.
 *
 * OWASP recomienda ≥600.000 iteraciones para PBKDF2-HMAC-SHA256 (2023+).
 * Cada intento de derivación es costoso en CPU, lo que mitiga fuerza bruta
 * incluso si un atacante obtiene el salt y los datos cifrados offline.
 */
export const PBKDF2_ITERATIONS = 600_000

export const PBKDF2_HASH = 'SHA-256' as const

/** AES-256-GCM: cifrado autenticado (AEAD). El tag GCM detecta manipulación del ciphertext. */
export const AES_ALGORITHM = 'AES-GCM' as const

/** Longitud de clave AES-256 en bits. */
export const AES_KEY_LENGTH_BITS = 256

/**
 * IV de 96 bits (12 bytes): longitud recomendada por NIST para GCM.
 * Un IV aleatorio único por mensaje evita ataques de reutilización de nonce.
 */
export const GCM_IV_LENGTH_BYTES = 12

/** Salt de 16 bytes (128 bits): entropía suficiente para identidad de bóveda. */
export const SALT_LENGTH_BYTES = 16

export const CRYPTO_PROTOCOL_VERSION = 1 as const

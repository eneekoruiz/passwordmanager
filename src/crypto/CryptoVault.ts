import {
  AES_ALGORITHM,
  AES_KEY_LENGTH_BITS,
  CRYPTO_PROTOCOL_VERSION,
  GCM_IV_LENGTH_BYTES,
  PBKDF2_HASH,
  PBKDF2_ITERATIONS,
  SALT_LENGTH_BYTES,
} from './constants'
import {
  base64ToBytes,
  bytesToArrayBuffer,
  bytesToBase64,
  bytesToString,
  stringToBytes,
} from './encoding'
import type { EncryptedPayload, RecoveryBundle, VaultMetadata } from './types'

/**
 * @class CryptoVault
 * @description Motor criptográfico Zero-Knowledge que implementa la encriptación y desencriptación
 * de la bóveda usando la Web Crypto API estándar del navegador.
 *
 * Principios de Diseño:
 * 1. Zero-Knowledge: La clave maestra nunca sale del dispositivo ni se almacena; se deriva al vuelo.
 * 2. Claves No Extractables: La clave derivada de sesión se crea con `extractable: false` para evitar
 *    que software malicioso pueda leer los bytes directamente de la memoria usando JavaScript.
 * 3. AES-GCM (AEAD): Proporciona confidencialidad y autenticación. Si el ciphertext es alterado,
 *    el proceso de desencriptado fallará de forma nativa e inmediata.
 */
export class CryptoVault {
  /** Clave criptográfica derivada mantenida en memoria de sesión; null si la bóveda está bloqueada. */
  private sessionKey: CryptoKey | null = null

  /**
   * Comprueba si la bóveda está desbloqueada y lista para operar.
   * @returns {boolean} true si existe una clave de sesión activa.
   */
  isUnlocked(): boolean {
    return this.sessionKey !== null
  }

  /**
   * Genera una secuencia de bytes aleatorios usando criptografía del sistema (crypto.getRandomValues).
   * @param {number} length - Cantidad de bytes requeridos.
   * @returns {Uint8Array} Array de bytes aleatorios criptográficamente seguros.
   */
  static generateRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    return bytes
  }

  /**
   * Genera un salt único y aleatorio para inicializar una bóveda.
   * @returns {Uint8Array} Salt aleatorio para derivación de claves.
   */
  static generateSalt(): Uint8Array {
    return CryptoVault.generateRandomBytes(SALT_LENGTH_BYTES)
  }

  /**
   * Genera un Vector de Inicialización (IV) aleatorio y único para operaciones AES-GCM.
   * Es crucial que cada llamada a encriptar use un IV único para evitar comprometer el algoritmo.
   * @returns {Uint8Array} IV de 12 bytes (96 bits) recomendado para GCM.
   */
  static generateIv(): Uint8Array {
    return CryptoVault.generateRandomBytes(GCM_IV_LENGTH_BYTES)
  }

  /**
   * Genera los metadatos iniciales de la bóveda para persistencia.
   * @param {Uint8Array} salt - Salt utilizado para la derivación.
   * @returns {VaultMetadata} Objeto con el salt serializado en base64 y metadatos temporales.
   */
  static createVaultMetadata(salt: Uint8Array): VaultMetadata {
    return {
      salt: bytesToBase64(salt),
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * Deriva una CryptoKey simétrica AES-256 usando PBKDF2 a partir de la contraseña maestra y un salt.
   *
   * @param {string} masterPassword - Contraseña maestra introducida por el usuario.
   * @param {Uint8Array} salt - Salt único asociado a la bóveda del usuario.
   * @returns {Promise<CryptoKey>} Clave criptográfica simétrica no extractable para encriptado/desencriptado.
   * @throws {Error} Si la contraseña maestra está vacía.
   */
  static async deriveKey(
    masterPassword: string,
    salt: Uint8Array,
  ): Promise<CryptoKey> {
    if (!masterPassword) {
      throw new Error('La contraseña maestra no puede estar vacía.')
    }

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      bytesToArrayBuffer(stringToBytes(masterPassword)),
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    )

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: bytesToArrayBuffer(salt),
        iterations: PBKDF2_ITERATIONS,
        hash: PBKDF2_HASH,
      },
      keyMaterial,
      { name: AES_ALGORITHM, length: AES_KEY_LENGTH_BITS },
      false, // extractable = false (seguridad contra exfiltración por JS de terceros)
      ['encrypt', 'decrypt'],
    )
  }

  /**
   * Inicializa la sesión derivando la clave a partir de la contraseña y el salt de IndexedDB.
   * @param {string} masterPassword - Contraseña introducida para el desbloqueo.
   * @param {Uint8Array} salt - Salt de la bóveda actual.
   * @returns {Promise<void>}
   */
  async unlock(masterPassword: string, salt: Uint8Array): Promise<void> {
    this.sessionKey = await CryptoVault.deriveKey(masterPassword, salt)
  }

  /**
   * Cierra la sesión activa sobrescribiendo la clave de sesión a null.
   * Se ejecuta automáticamente al bloquear la bóveda.
   */
  lock(): void {
    this.sessionKey = null
  }

  /**
   * Obtiene la clave de sesión activa. Lanza error si la bóveda está bloqueada.
   * @private
   * @returns {CryptoKey} Clave criptográfica simétrica.
   */
  private getSessionKey(): CryptoKey {
    if (!this.sessionKey) {
      throw new Error(
        'La bóveda está bloqueada. Desbloquea con unlock() antes de cifrar o descifrar.',
      )
    }
    return this.sessionKey
  }

  /**
   * Cifra una cadena de texto sin formato usando la clave de sesión activa.
   * @param {string} plaintext - Cadena de texto a cifrar.
   * @returns {Promise<EncryptedPayload>} Payload cifrado serializable.
   */
  async encryptString(plaintext: string): Promise<EncryptedPayload> {
    return CryptoVault.encryptBytes(stringToBytes(plaintext), this.getSessionKey())
  }

  /**
   * Descifra un payload cifrado y lo convierte a una cadena de texto legible.
   * @param {EncryptedPayload} payload - Payload cifrado de la base de datos.
   * @returns {Promise<string>} Cadena original en texto plano.
   */
  async decryptString(payload: EncryptedPayload): Promise<string> {
    const bytes = await CryptoVault.decryptBytes(payload, this.getSessionKey())
    return bytesToString(bytes)
  }

  /**
   * Serializa un objeto genérico a JSON y lo cifra usando la clave de sesión.
   * @param {T} value - Objeto a cifrar.
   * @returns {Promise<EncryptedPayload>} Payload cifrado serializable.
   */
  async encryptJson<T>(value: T): Promise<EncryptedPayload> {
    const json = JSON.stringify(value)
    return this.encryptString(json)
  }

  /**
   * Descifra un payload cifrado y lo deserializa de vuelta a su tipo de objeto original.
   * @param {EncryptedPayload} payload - Payload cifrado de la base de datos.
   * @returns {Promise<T>} Objeto deserializado de tipo T.
   */
  async decryptJson<T>(payload: EncryptedPayload): Promise<T> {
    const json = await this.decryptString(payload)
    return JSON.parse(json) as T
  }

  /**
   * Cifra un array de bytes usando una clave de cifrado explícita.
   * Cada llamada genera un IV único para evitar ataques de reutilización.
   *
   * @param {Uint8Array} data - Array de bytes a cifrar.
   * @param {CryptoKey} key - Clave simétrica de cifrado.
   * @returns {Promise<EncryptedPayload>} Payload cifrado.
   */
  static async encryptBytes(
    data: Uint8Array,
    key: CryptoKey,
  ): Promise<EncryptedPayload> {
    const iv = CryptoVault.generateIv()
    const ciphertext = await crypto.subtle.encrypt(
      { name: AES_ALGORITHM, iv: bytesToArrayBuffer(iv) },
      key,
      bytesToArrayBuffer(data),
    )

    return {
      v: CRYPTO_PROTOCOL_VERSION,
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(ciphertext)),
    }
  }

  /**
   * Descifra un array de bytes usando una clave simétrica explícita.
   * Si el payload ha sido manipulado, Web Crypto API lanzará un error de validación del tag GCM.
   *
   * @param {EncryptedPayload} payload - Payload cifrado.
   * @param {CryptoKey} key - Clave simétrica de descifrado.
   * @returns {Promise<Uint8Array>} Array de bytes descifrados original.
   */
  static async decryptBytes(
    payload: EncryptedPayload,
    key: CryptoKey,
  ): Promise<Uint8Array> {
    if (payload.v !== CRYPTO_PROTOCOL_VERSION) {
      throw new Error(`Versión de protocolo no soportada: ${payload.v}`)
    }

    const iv = base64ToBytes(payload.iv)
    const ciphertext = base64ToBytes(payload.data)

    const plaintext = await crypto.subtle.decrypt(
      { name: AES_ALGORITHM, iv: bytesToArrayBuffer(iv) },
      key,
      bytesToArrayBuffer(ciphertext),
    )

    return new Uint8Array(plaintext)
  }

  /**
   * Flujo de Creación de Bóveda: crea un salt, deriva la clave y devuelve los metadatos y el payload inicial cifrado.
   *
   * @param {string} masterPassword - Contraseña elegida por el usuario.
   * @param {T} initialPlainData - Objeto de inicialización (ej: marcador de verificación).
   * @returns {Promise<{ metadata: VaultMetadata; encryptedPayload: EncryptedPayload }>} Bóveda cifrada lista para IndexedDB.
   */
  static async createEncryptedVault<T>(
    masterPassword: string,
    initialPlainData: T,
  ): Promise<{ metadata: VaultMetadata; encryptedPayload: EncryptedPayload }> {
    const salt = CryptoVault.generateSalt()
    const key = await CryptoVault.deriveKey(masterPassword, salt)
    const encryptedPayload = await CryptoVault.encryptBytes(
      stringToBytes(JSON.stringify(initialPlainData)),
      key,
    )

    // Generar llaves asimétricas (RSA-OAEP) para Compartición segura
    const { generateAsymmetricKeyPair, exportKeyToJwkString } = await import('./asymmetric')
    const keyPair = await generateAsymmetricKeyPair()
    const publicKeyJwk = await exportKeyToJwkString(keyPair.publicKey)
    const privateKeyJwk = await exportKeyToJwkString(keyPair.privateKey)
    
    const encryptedPrivateKey = await CryptoVault.encryptBytes(
      stringToBytes(privateKeyJwk),
      key,
    )

    const metadata = CryptoVault.createVaultMetadata(salt)
    metadata.asymmetricKeys = {
      publicKey: publicKeyJwk,
      privateKey: encryptedPrivateKey
    }

    return {
      metadata,
      encryptedPayload,
    }
  }

  static async createRecoveryBundle(
    recoveryPhrase: string,
    masterPassword: string,
  ): Promise<RecoveryBundle> {
    const salt = CryptoVault.generateSalt()
    const key = await CryptoVault.deriveKey(recoveryPhrase, salt)
    const encryptedMasterPassword = await CryptoVault.encryptBytes(
      stringToBytes(masterPassword),
      key,
    )

    return {
      salt: bytesToBase64(salt),
      encryptedMasterPassword,
      createdAt: new Date().toISOString(),
    }
  }

  static async decryptRecoveryBundle(
    recoveryPhrase: string,
    recoveryBundle: RecoveryBundle,
  ): Promise<string> {
    const salt = base64ToBytes(recoveryBundle.salt)
    const key = await CryptoVault.deriveKey(recoveryPhrase, salt)
    const plaintext = await CryptoVault.decryptBytes(
      recoveryBundle.encryptedMasterPassword,
      key,
    )
    return bytesToString(plaintext)
  }

  /**
   * Verifica si una contraseña maestra es válida intentando descifrar un marcador de verificación.
   *
   * @param {string} masterPassword - Contraseña maestra a verificar.
   * @param {Uint8Array} salt - Salt de la bóveda del usuario.
   * @param {EncryptedPayload} verificationPayload - Marcador de verificación cifrado.
   * @returns {Promise<boolean>} true si la contraseña es correcta; false si falla la autenticación.
   */
  static async verifyMasterPassword(
    masterPassword: string,
    salt: Uint8Array,
    verificationPayload: EncryptedPayload,
  ): Promise<boolean> {
    try {
      const key = await CryptoVault.deriveKey(masterPassword, salt)
      await CryptoVault.decryptBytes(verificationPayload, key)
      return true
    } catch {
      return false
    }
  }
}

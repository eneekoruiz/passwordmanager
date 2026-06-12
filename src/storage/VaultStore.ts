import { CryptoVault } from '../crypto/CryptoVault'
import { base64ToBytes, bytesToBase64, stringToBytes, bytesToString } from '../crypto/encoding'
import type { EncryptedPayload } from '../crypto/types'
import type { Platform } from '../types'
import { getVaultDb } from './vaultDb'
import { generateId } from '../utils/id'

const VAULT_META_KEY = 'vault' as const
const VAULT_VERIFICATION_MARKER = { marker: 'contras-vault-v1' } as const

/**
 * @interface ProfileRecord
 * @description Representa el registro de metadatos de un perfil en IndexedDB.
 */
interface ProfileRecord {
  id: string
  name: string
  salt: string
  verification: EncryptedPayload
  createdAt: string
}

/**
 * @class VaultStore
 * @description Repositorio de datos encargado de la persistencia local de la bóveda en IndexedDB.
 * Sostiene el aislamiento de múltiples perfiles locales mediante el prefijado de claves en la base de datos.
 */
export class VaultStore {
  /**
   * Crea una instancia de VaultStore.
   * @param {CryptoVault} vault - Instancia del motor criptográfico activo.
   */
  constructor(private readonly vault: CryptoVault) {}

  /**
   * Indica si la base de datos tiene al menos un perfil registrado.
   * @returns {Promise<boolean>} true si hay algún perfil registrado en el sistema.
   */
  async isInitialized(): Promise<boolean> {
    const db = await getVaultDb()
    const keys = await db.getAllKeys('meta')
    
    // Si existe la clave legada 'vault' o cualquier perfil, está inicializado
    return keys.some((k) => k === VAULT_META_KEY || (typeof k === 'string' && k.startsWith('profile_')))
  }

  /**
   * Lista todos los perfiles locales creados en el dispositivo.
   * Realiza una migración automática transparente si se detecta una bóveda legada de la versión anterior.
   *
   * @returns {Promise<{ id: string; name: string; createdAt: string }[]>} Lista ordenada de perfiles.
   */
  async listProfiles(): Promise<{ id: string; name: string; createdAt: string }[]> {
    const db = await getVaultDb()
    
    // Migración automática de Bóveda Legada a Perfil por Defecto
    const legacyMeta = await db.get('meta', VAULT_META_KEY)
    if (legacyMeta) {
      const defaultProfileId = 'default'
      const defaultProfile: ProfileRecord = {
        id: defaultProfileId,
        name: 'Bóveda Principal',
        salt: legacyMeta.salt,
        verification: legacyMeta.verification,
        createdAt: legacyMeta.createdAt || new Date().toISOString()
      }
      
      // Escribir el nuevo perfil
      await db.put('meta', defaultProfile, `profile_${defaultProfileId}`)
      // Eliminar el registro de configuración anterior
      await db.delete('meta', VAULT_META_KEY)
      
      // Migrar plataformas sin prefijo a plataformas prefijadas con 'default_'
      const allPlatformKeys = await db.getAllKeys('platforms')
      for (const key of allPlatformKeys) {
        if (!key.includes('_')) {
          const platformPayload = await db.get('platforms', key)
          if (platformPayload) {
            await db.put('platforms', platformPayload, `${defaultProfileId}_${key}`)
            await db.delete('platforms', key)
          }
        }
      }
    }

    const tx = db.transaction('meta', 'readonly')
    const keys = await tx.store.getAllKeys()
    const profiles: { id: string; name: string; createdAt: string }[] = []
    
    for (const key of keys) {
      if (key.startsWith('profile_')) {
        const profileData = (await tx.store.get(key)) as ProfileRecord | undefined
        if (profileData) {
          profiles.push({
            id: profileData.id,
            name: profileData.name,
            createdAt: profileData.createdAt
          })
        }
      }
    }
    
    return profiles.sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Crea un nuevo perfil independiente en la base de datos local con su propio salt PBKDF2.
   *
   * @param {string} name - Nombre descriptivo para el perfil (ej. "Trabajo").
   * @param {string} password - Contraseña maestra para este perfil en particular.
   * @returns {Promise<string>} ID generado para el nuevo perfil.
   */
  async createProfile(name: string, password: string): Promise<string> {
    const profileId = generateId()
    const { metadata, encryptedPayload } = await CryptoVault.createEncryptedVault(
      password,
      VAULT_VERIFICATION_MARKER,
    )

    const db = await getVaultDb()
    const profileRecord: ProfileRecord = {
      id: profileId,
      name: name.trim(),
      salt: metadata.salt,
      verification: encryptedPayload,
      createdAt: metadata.createdAt,
    }
    await db.put('meta', profileRecord, `profile_${profileId}`)
    return profileId
  }

  /**
   * Desbloquea la sesión criptográfica para el perfil especificado.
   *
   * @param {string} profileId - ID del perfil a desbloquear.
   * @param {string} password - Contraseña maestra de dicho perfil.
   * @returns {Promise<boolean>} true si el desbloqueo fue exitoso.
   */
  async unlockProfile(profileId: string, password: string): Promise<boolean> {
    const db = await getVaultDb()
    const profileRecord = (await db.get('meta', `profile_${profileId}`)) as ProfileRecord | undefined
    if (!profileRecord) return false

    const salt = base64ToBytes(profileRecord.salt)
    const valid = await CryptoVault.verifyMasterPassword(
      password,
      salt,
      profileRecord.verification,
    )
    if (!valid) return false

    await this.vault.unlock(password, salt)
    return true
  }

  /**
   * Elimina por completo un perfil y todas sus plataformas asociadas.
   *
   * @param {string} profileId - ID del perfil a eliminar.
   * @returns {Promise<void>}
   */
  async deleteProfile(profileId: string): Promise<void> {
    const db = await getVaultDb()
    
    // Eliminar el perfil en la tabla meta
    await db.delete('meta', `profile_${profileId}`)
    
    // Eliminar todas las plataformas con prefijo del perfil
    const tx = db.transaction('platforms', 'readwrite')
    const keys = await tx.store.getAllKeys()
    const prefix = `${profileId}_`
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        await tx.store.delete(key)
      }
    }
    await tx.done
  }

  /**
   * Lee y descifra las plataformas que pertenecen únicamente al perfil activo.
   *
   * @param {string} profileId - ID del perfil activo.
   * @returns {Promise<Platform[]>} Array de plataformas ordenadas.
   */
  async loadAllPlatforms(profileId: string): Promise<Platform[]> {
    if (!this.vault.isUnlocked()) {
      throw new Error('La bóveda debe estar desbloqueada para leer plataformas.')
    }

    const db = await getVaultDb()
    const tx = db.transaction('platforms', 'readonly')
    const allKeys = await tx.store.getAllKeys()
    const prefix = `${profileId}_`

    const platforms: Platform[] = []
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        const payload = await tx.store.get(key)
        if (payload) {
          platforms.push(await this.vault.decryptJson<Platform>(payload))
        }
      }
    }

    return platforms.sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Cifra y persiste una plataforma en IndexedDB bajo el prefijo del perfil activo.
   *
   * @param {string} profileId - ID del perfil activo.
   * @param {Platform} platform - Plataforma a guardar.
   * @returns {Promise<void>}
   */
  async savePlatform(profileId: string, platform: Platform): Promise<void> {
    if (!this.vault.isUnlocked()) {
      throw new Error('La bóveda debe estar desbloqueada para guardar.')
    }

    const encrypted: EncryptedPayload = await this.vault.encryptJson(platform)
    const db = await getVaultDb()
    await db.put('platforms', encrypted, `${profileId}_${platform.id}`)
  }

  /**
   * Guarda múltiples plataformas del perfil en una única transacción de IndexedDB.
   *
   * @param {string} profileId - ID del perfil activo.
   * @param {Platform[]} platforms - Array de plataformas a guardar en lote.
   * @returns {Promise<void>}
   */
  async saveMultiplePlatforms(profileId: string, platforms: Platform[]): Promise<void> {
    if (!this.vault.isUnlocked()) {
      throw new Error('La bóveda debe estar desbloqueada para guardar.')
    }

    const db = await getVaultDb()
    const tx = db.transaction('platforms', 'readwrite')
    
    for (const platform of platforms) {
      const encrypted: EncryptedPayload = await this.vault.encryptJson(platform)
      await tx.store.put(encrypted, `${profileId}_${platform.id}`)
    }

    await tx.done
  }

  /**
   * Elimina una plataforma del perfil activo.
   *
   * @param {string} profileId - ID del perfil activo.
   * @param {string} platformId - ID de la plataforma.
   * @returns {Promise<void>}
   */
  async deletePlatform(profileId: string, platformId: string): Promise<void> {
    const db = await getVaultDb()
    await db.delete('platforms', `${profileId}_${platformId}`)
  }

  /**
   * Exporta las plataformas de un perfil en un JSON cifrado.
   *
   * @param {string} profileId - ID del perfil a exportar.
   * @param {string} masterPassword - Contraseña de cifrado del backup.
   * @returns {Promise<string>} Backup serializado.
   */
  async exportBackup(profileId: string, masterPassword: string): Promise<string> {
    const db = await getVaultDb()
    const profileRecord = (await db.get('meta', `profile_${profileId}`)) as ProfileRecord | undefined
    if (!profileRecord) throw new Error('Perfil no encontrado.')

    const tx = db.transaction('platforms', 'readonly')
    const allKeys = await tx.store.getAllKeys()
    const prefix = `${profileId}_`

    const platformsData: { id: string; payload: EncryptedPayload }[] = []
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        const payload = await tx.store.get(key)
        if (payload) {
          const platformId = key.substring(prefix.length)
          platformsData.push({
            id: platformId,
            payload
          })
        }
      }
    }

    const databaseDump = {
      meta: {
        salt: profileRecord.salt,
        verification: profileRecord.verification,
        createdAt: profileRecord.createdAt,
        name: profileRecord.name
      },
      platforms: platformsData
    }

    const salt = CryptoVault.generateSalt()
    const key = await CryptoVault.deriveKey(masterPassword, salt)
    const dumpString = JSON.stringify(databaseDump)
    const encryptedPayload = await CryptoVault.encryptBytes(
      stringToBytes(dumpString),
      key
    )

    const backup = {
      v: 1,
      salt: bytesToBase64(salt),
      iv: encryptedPayload.iv,
      data: encryptedPayload.data
    }

    return JSON.stringify(backup, null, 2)
  }

  /**
   * Importa y descifra un backup, sobrescribiendo las plataformas del perfil activo.
   *
   * @param {string} profileId - ID del perfil activo a sobrescribir.
   * @param {string} backupJsonString - Archivo JSON de backup.
   * @param {string} masterPassword - Contraseña maestra original del backup.
   * @returns {Promise<void>}
   */
  async importBackup(profileId: string, backupJsonString: string, masterPassword: string): Promise<void> {
    const backup = JSON.parse(backupJsonString)
    if (!backup.salt || !backup.iv || !backup.data) {
      throw new Error('Formato de copia de seguridad no válido.')
    }

    const salt = base64ToBytes(backup.salt)
    const key = await CryptoVault.deriveKey(masterPassword, salt)

    const encryptedPayload: EncryptedPayload = {
      v: backup.v || 1,
      iv: backup.iv,
      data: backup.data
    }

    const decryptedBytes = await CryptoVault.decryptBytes(encryptedPayload, key)
    const decryptedString = bytesToString(decryptedBytes)
    const databaseDump = JSON.parse(decryptedString)

    if (!databaseDump.meta || !databaseDump.platforms) {
      throw new Error('El contenido del backup no tiene el formato correcto.')
    }

    const db = await getVaultDb()
    const profileRecord = (await db.get('meta', `profile_${profileId}`)) as ProfileRecord | undefined
    if (!profileRecord) throw new Error('Perfil no encontrado.')

    // Actualizar las credenciales de cifrado del perfil para alinearlas con el backup
    const updatedProfile: ProfileRecord = {
      ...profileRecord,
      name: databaseDump.meta.name || profileRecord.name,
      salt: databaseDump.meta.salt,
      verification: databaseDump.meta.verification
    }
    await db.put('meta', updatedProfile, `profile_${profileId}`)

    // Limpiar las plataformas actuales de este perfil
    const txDelete = db.transaction('platforms', 'readwrite')
    const allKeys = await txDelete.store.getAllKeys()
    const prefix = `${profileId}_`
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        await txDelete.store.delete(key)
      }
    }
    await txDelete.done

    // Insertar nuevas plataformas
    const txWrite = db.transaction('platforms', 'readwrite')
    for (const record of databaseDump.platforms) {
      await txWrite.store.put(record.payload, `${profileId}_${record.id}`)
    }
    await txWrite.done
  }

  /**
   * Exporta las plataformas de un perfil en un JSON cifrado usando la clave de sesión activa (sin requerir contraseña).
   *
   * @param {string} profileId - ID del perfil activo.
   * @returns {Promise<string>} Blob cifrado en formato de copia de seguridad.
   */
  async exportCloudPayload(profileId: string): Promise<string> {
    if (!this.vault.isUnlocked()) {
      throw new Error('La bóveda debe estar desbloqueada para exportar.')
    }

    const db = await getVaultDb()
    const profileRecord = (await db.get('meta', `profile_${profileId}`)) as ProfileRecord | undefined
    if (!profileRecord) throw new Error('Perfil no encontrado.')

    const tx = db.transaction('platforms', 'readonly')
    const allKeys = await tx.store.getAllKeys()
    const prefix = `${profileId}_`

    const platformsData: { id: string; payload: EncryptedPayload }[] = []
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        const payload = await tx.store.get(key)
        if (payload) {
          const platformId = key.substring(prefix.length)
          platformsData.push({
            id: platformId,
            payload
          })
        }
      }
    }

    const databaseDump = {
      meta: {
        salt: profileRecord.salt,
        verification: profileRecord.verification,
        createdAt: profileRecord.createdAt,
        name: profileRecord.name
      },
      platforms: platformsData
    }

    // Cifrar usando la clave de sesión activa de memoria
    const encryptedPayload = await this.vault.encryptString(JSON.stringify(databaseDump))

    const syncBlob = {
      v: 1,
      salt: profileRecord.salt,
      iv: encryptedPayload.iv,
      data: encryptedPayload.data
    }

    return JSON.stringify(syncBlob)
  }

  /**
   * Descifra e importa un blob de la nube en un dispositivo nuevo, creando el perfil y sus plataformas.
   *
   * @param {string} profileId - ID del perfil a crear/restaurar.
   * @param {string} payloadJson - Blob cifrado descargado de la nube.
   * @param {string} masterPassword - Contraseña maestra para derivar la clave local.
   * @returns {Promise<void>}
   */
  async restoreCloudPayload(profileId: string, payloadJson: string, masterPassword: string): Promise<void> {
    const backup = JSON.parse(payloadJson)
    if (!backup.salt || !backup.iv || !backup.data) {
      throw new Error('Formato de datos en la nube no válido.')
    }

    const salt = base64ToBytes(backup.salt)
    const key = await CryptoVault.deriveKey(masterPassword, salt)

    const encryptedPayload: EncryptedPayload = {
      v: backup.v || 1,
      iv: backup.iv,
      data: backup.data
    }

    const decryptedBytes = await CryptoVault.decryptBytes(encryptedPayload, key)
    const decryptedString = bytesToString(decryptedBytes)
    const databaseDump = JSON.parse(decryptedString)

    if (!databaseDump.meta || !databaseDump.platforms) {
      throw new Error('El contenido descargado de la nube no tiene el formato correcto.')
    }

    const db = await getVaultDb()

    // Registrar los metadatos del perfil en la tabla meta
    const restoredProfile: ProfileRecord = {
      id: profileId,
      name: databaseDump.meta.name || 'Bóveda Nube',
      salt: databaseDump.meta.salt,
      verification: databaseDump.meta.verification,
      createdAt: databaseDump.meta.createdAt || new Date().toISOString()
    }
    await db.put('meta', restoredProfile, `profile_${profileId}`)

    // Limpiar las plataformas actuales de este perfil (si existieran)
    const txDelete = db.transaction('platforms', 'readwrite')
    const allKeys = await txDelete.store.getAllKeys()
    const prefix = `${profileId}_`
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        await txDelete.store.delete(key)
      }
    }
    await txDelete.done

    // Registrar todas las plataformas importadas
    const txWrite = db.transaction('platforms', 'readwrite')
    for (const record of databaseDump.platforms) {
      await txWrite.store.put(record.payload, `${profileId}_${record.id}`)
    }
    await txWrite.done
  }
}

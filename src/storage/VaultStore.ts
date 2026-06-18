import { CryptoVault } from '../crypto/CryptoVault'
import { base64ToBytes, bytesToBase64, stringToBytes, bytesToString } from '../crypto/encoding'
import type { EncryptedPayload, RecoveryBundle } from '../crypto/types'
import type { Identity, LocalCategory, LocalVaultItem } from '../types'
import { getVaultDb } from './vaultDb'
import { generateId } from '../utils/id'
import { identityMatchesEmail, normalizeIdentityRecord } from '../utils/identity'
import { normalizeLocalCategory, normalizeUnknownLocalVaultItem } from '../utils/vaultItem'

const VAULT_META_KEY = 'vault' as const
const VAULT_VERIFICATION_MARKER = { marker: 'contras-vault-v1' } as const
const LOCAL_ITEM_KEY_SEGMENT = '_item_'
const LOCAL_CATEGORY_KEY_SEGMENT = '_category_'

/**
 * @interface ProfileRecord
 * @description Representa el registro de metadatos de un perfil en IndexedDB.
 */
interface ProfileRecord {
  id: string
  name: string
  salt: string
  verification: EncryptedPayload
  recovery?: RecoveryBundle
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
  async createProfile(name: string, password: string, recoveryPhrase?: string): Promise<string> {
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
      recovery: recoveryPhrase
        ? await CryptoVault.createRecoveryBundle(recoveryPhrase, password)
        : undefined,
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

  async recoverMasterPassword(profileId: string, recoveryPhrase: string): Promise<string> {
    const db = await getVaultDb()
    const profileRecord = (await db.get('meta', `profile_${profileId}`)) as ProfileRecord | undefined
    if (!profileRecord?.recovery) {
      throw new Error('Esta boveda no tiene kit de recuperacion configurado.')
    }
    return CryptoVault.decryptRecoveryBundle(recoveryPhrase, profileRecord.recovery)
  }

  async rotateProfilePassword(
    profileId: string,
    currentPassword: string,
    nextPassword: string,
    recoveryPhrase: string,
  ): Promise<void> {
    const unlocked = await this.unlockProfile(profileId, currentPassword)
    if (!unlocked) throw new Error('No se pudo validar la clave actual recuperada.')

    const [identities, localItems, localCategories] = await Promise.all([
      this.loadAllIdentities(profileId),
      this.loadLocalItems(profileId),
      this.loadLocalCategories(profileId),
    ])
    const { metadata, encryptedPayload } = await CryptoVault.createEncryptedVault(
      nextPassword,
      VAULT_VERIFICATION_MARKER,
    )
    const db = await getVaultDb()
    const profileRecord = (await db.get('meta', `profile_${profileId}`)) as ProfileRecord | undefined
    if (!profileRecord) throw new Error('Perfil no encontrado.')

    const updatedProfile: ProfileRecord = {
      ...profileRecord,
      salt: metadata.salt,
      verification: encryptedPayload,
      recovery: await CryptoVault.createRecoveryBundle(recoveryPhrase, nextPassword),
    }
    await db.put('meta', updatedProfile, `profile_${profileId}`)
    await this.vault.unlock(nextPassword, base64ToBytes(metadata.salt))

    await this.saveMultipleIdentities(profileId, identities)
    for (const item of localItems) {
      await this.saveLocalItem(profileId, item)
    }
    for (const category of localCategories) {
      await this.saveLocalCategory(profileId, category)
    }
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
  async loadAllIdentities(profileId: string): Promise<Identity[]> {
    if (!this.vault.isUnlocked()) {
      throw new Error('La bóveda debe estar desbloqueada para leer identidades.')
    }

    const db = await getVaultDb()
    const tx = db.transaction('platforms', 'readonly')
    const allKeys = await tx.store.getAllKeys()
    const prefix = `${profileId}_`

    const payloads: EncryptedPayload[] = []
    for (const key of allKeys) {
      if (
        key.startsWith(prefix) &&
        !key.includes(LOCAL_ITEM_KEY_SEGMENT) &&
        !key.includes(LOCAL_CATEGORY_KEY_SEGMENT)
      ) {
        const payload = await tx.store.get(key)
        if (payload) {
          payloads.push(payload)
        }
      }
    }
    await tx.done

    const identities: Identity[] = []
    for (const payload of payloads) {
      const identity = normalizeIdentityRecord(await this.vault.decryptJson<unknown>(payload))
      const existingIdentity = identities.find((item) => identityMatchesEmail(item, identity.email))
      if (existingIdentity) {
        existingIdentity.platforms.push(...identity.platforms)
        existingIdentity.updatedAt = new Date().toISOString()
      } else {
        identities.push(identity)
      }
    }

    return identities.sort((a, b) => a.email.localeCompare(b.email))
  }

  async loadLocalItems(profileId: string): Promise<LocalVaultItem[]> {
    if (!this.vault.isUnlocked()) {
      throw new Error('La bóveda debe estar desbloqueada para leer secretos locales.')
    }

    const db = await getVaultDb()
    const tx = db.transaction('platforms', 'readonly')
    const allKeys = await tx.store.getAllKeys()
    const prefix = `${profileId}${LOCAL_ITEM_KEY_SEGMENT}`

    const payloads: EncryptedPayload[] = []
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        const payload = await tx.store.get(key)
        if (payload) payloads.push(payload)
      }
    }
    await tx.done

    const items: LocalVaultItem[] = []
    for (const payload of payloads) {
      const item = normalizeUnknownLocalVaultItem(await this.vault.decryptJson<unknown>(payload))
      if (item) items.push(item)
    }

    return items.sort((a, b) => a.title.localeCompare(b.title))
  }

  async loadLocalCategories(profileId: string): Promise<LocalCategory[]> {
    if (!this.vault.isUnlocked()) {
      throw new Error('La bóveda debe estar desbloqueada para leer secciones locales.')
    }

    const db = await getVaultDb()
    const tx = db.transaction('platforms', 'readonly')
    const allKeys = await tx.store.getAllKeys()
    const prefix = `${profileId}${LOCAL_CATEGORY_KEY_SEGMENT}`

    const payloads: EncryptedPayload[] = []
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        const payload = await tx.store.get(key)
        if (payload) payloads.push(payload)
      }
    }
    await tx.done

    const categories: LocalCategory[] = []
    for (const payload of payloads) {
      const value = await this.vault.decryptJson<unknown>(payload)
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as LocalCategory).id === 'string' &&
        typeof (value as LocalCategory).label === 'string'
      ) {
        categories.push(normalizeLocalCategory(value as LocalCategory))
      }
    }

    return categories.sort((a, b) => a.label.localeCompare(b.label))
  }

  /**
   * Cifra y persiste una plataforma en IndexedDB bajo el prefijo del perfil activo.
   *
   * @param {string} profileId - ID del perfil activo.
   * @param {Platform} platform - Plataforma a guardar.
   * @returns {Promise<void>}
   */
  async saveIdentity(profileId: string, identity: Identity): Promise<void> {
    if (!this.vault.isUnlocked()) {
      throw new Error('La bóveda debe estar desbloqueada para guardar.')
    }

    const encrypted: EncryptedPayload = await this.vault.encryptJson(identity)
    const db = await getVaultDb()
    await db.put('platforms', encrypted, `${profileId}_${identity.id}`)
  }

  /**
   * Guarda múltiples plataformas del perfil en una única transacción de IndexedDB.
   *
   * @param {string} profileId - ID del perfil activo.
   * @param {Platform[]} platforms - Array de plataformas a guardar en lote.
   * @returns {Promise<void>}
   */
  async saveMultipleIdentities(profileId: string, identities: Identity[]): Promise<void> {
    if (!this.vault.isUnlocked()) {
      throw new Error('La bóveda debe estar desbloqueada para guardar.')
    }

    const encryptedIdentities = await Promise.all(
      identities.map(async (identity) => ({
        key: `${profileId}_${identity.id}`,
        payload: await this.vault.encryptJson(identity),
      })),
    )

    const db = await getVaultDb()
    const tx = db.transaction('platforms', 'readwrite')
    
    for (const record of encryptedIdentities) {
      await tx.store.put(record.payload, record.key)
    }

    await tx.done
  }

  async saveLocalItem(profileId: string, item: LocalVaultItem): Promise<void> {
    if (!this.vault.isUnlocked()) {
      throw new Error('La bóveda debe estar desbloqueada para guardar.')
    }

    const encrypted: EncryptedPayload = await this.vault.encryptJson(item)
    const db = await getVaultDb()
    await db.put('platforms', encrypted, `${profileId}${LOCAL_ITEM_KEY_SEGMENT}${item.id}`)
  }

  async deleteLocalItem(profileId: string, itemId: string): Promise<void> {
    const db = await getVaultDb()
    await db.delete('platforms', `${profileId}${LOCAL_ITEM_KEY_SEGMENT}${itemId}`)
  }

  async saveLocalCategory(profileId: string, category: LocalCategory): Promise<void> {
    if (!this.vault.isUnlocked()) {
      throw new Error('La bóveda debe estar desbloqueada para guardar secciones.')
    }

    const normalized = normalizeLocalCategory(category)
    const encrypted: EncryptedPayload = await this.vault.encryptJson(normalized)
    const db = await getVaultDb()
    await db.put('platforms', encrypted, `${profileId}${LOCAL_CATEGORY_KEY_SEGMENT}${normalized.id}`)
  }

  /**
   * Elimina una plataforma del perfil activo.
   *
   * @param {string} profileId - ID del perfil activo.
   * @param {string} platformId - ID de la plataforma.
   * @returns {Promise<void>}
   */
  async deleteIdentity(profileId: string, identityId: string): Promise<void> {
    const db = await getVaultDb()
    await db.delete('platforms', `${profileId}_${identityId}`)
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

    const identitiesData: { id: string; payload: EncryptedPayload }[] = []
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        const payload = await tx.store.get(key)
        if (payload) {
          try {
            const itemStr = await this.vault.decryptString(payload)
            const item = JSON.parse(itemStr)
            if (!item.isLocalOnly) {
              const platformId = key.substring(prefix.length)
              identitiesData.push({
                id: platformId,
                payload
              })
            }
          } catch (err) {
            console.error('Error decrypting item for cloud export', err)
          }
        }
      }
    }
    await tx.done

    const databaseDump = {
      meta: {
        salt: profileRecord.salt,
        verification: profileRecord.verification,
        createdAt: profileRecord.createdAt,
        name: profileRecord.name,
        recovery: profileRecord.recovery,
      },
      identities: identitiesData
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

    const importedRecords = databaseDump.identities ?? databaseDump.platforms
    if (!databaseDump.meta || !importedRecords) {
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
      verification: databaseDump.meta.verification,
      recovery: databaseDump.meta.recovery,
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
    for (const record of importedRecords) {
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
    if (!profileRecord) {
      const databaseDump = {
        meta: {
          salt: '',
          verification: { v: 1, iv: '', data: '' },
          createdAt: new Date().toISOString(),
          name: 'Bóveda Principal',
        },
        identities: []
      }
      const encryptedPayload = await this.vault.encryptString(JSON.stringify(databaseDump))
      const syncBlob = {
        v: 1,
        salt: '',
        iv: encryptedPayload.iv,
        data: encryptedPayload.data
      }
      return JSON.stringify(syncBlob)
    }

    const tx = db.transaction('platforms', 'readonly')
    const allKeys = await tx.store.getAllKeys()
    const prefix = `${profileId}_`

    const identitiesData: { id: string; payload: EncryptedPayload }[] = []
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        const payload = await tx.store.get(key)
        if (payload) {
          try {
            const itemStr = await this.vault.decryptString(payload)
            const item = JSON.parse(itemStr)
            if (!item.isLocalOnly) {
              const platformId = key.substring(prefix.length)
              identitiesData.push({
                id: platformId,
                payload
              })
            }
          } catch (err) {
            console.error('Error decrypting item for cloud export', err)
          }
        }
      }
    }
    await tx.done

    const databaseDump = {
      meta: {
        salt: profileRecord.salt,
        verification: profileRecord.verification,
        createdAt: profileRecord.createdAt,
        name: profileRecord.name,
        recovery: profileRecord.recovery,
      },
      identities: identitiesData
    }

    // Cifrar usando la clave de sesión activa de memoria
    const encryptedPayload = await this.vault.encryptString(JSON.stringify(databaseDump))

    const syncBlob = {
      v: 1,
      salt: profileRecord.salt,
      recovery: profileRecord.recovery,
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

    const importedRecords = databaseDump.identities ?? databaseDump.platforms
    if (!databaseDump.meta || !importedRecords) {
      throw new Error('El contenido descargado de la nube no tiene el formato correcto.')
    }

    const db = await getVaultDb()

    // Registrar los metadatos del perfil en la tabla meta
    const restoredProfile: ProfileRecord = {
      id: profileId,
      name: databaseDump.meta.name || 'Bóveda Nube',
      salt: databaseDump.meta.salt,
      verification: databaseDump.meta.verification,
      recovery: databaseDump.meta.recovery ?? backup.recovery,
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
    for (const record of importedRecords) {
      await txWrite.store.put(record.payload, `${profileId}_${record.id}`)
    }
    await txWrite.done
  }

  async restoreCloudPayloadWithActiveSession(profileId: string, payloadJson: string): Promise<void> {
    if (!this.vault.isUnlocked()) {
      throw new Error('La bóveda debe estar desbloqueada para restaurar desde la nube.')
    }

    const backup = JSON.parse(payloadJson)
    if (!backup.iv || !backup.data) {
      throw new Error('Formato de datos en la nube no válido.')
    }

    const decryptedString = await this.vault.decryptString({
      v: backup.v || 1,
      iv: backup.iv,
      data: backup.data,
    })
    const databaseDump = JSON.parse(decryptedString)
    const importedRecords = databaseDump.identities ?? databaseDump.platforms
    if (!databaseDump.meta || !importedRecords) {
      throw new Error('El contenido descargado de la nube no tiene el formato correcto.')
    }

    const db = await getVaultDb()
    let profileRecord = (await db.get('meta', `profile_${profileId}`)) as ProfileRecord | undefined
    if (!profileRecord) {
      profileRecord = {
        id: profileId,
        name: databaseDump.meta.name || 'Bóveda Principal',
        salt: databaseDump.meta.salt || backup.salt || '',
        verification: databaseDump.meta.verification || { v: 1, iv: '', data: '' },
        recovery: databaseDump.meta.recovery ?? backup.recovery,
        createdAt: databaseDump.meta.createdAt || new Date().toISOString()
      }
    }

    const restoredProfile: ProfileRecord = {
      ...profileRecord,
      name: databaseDump.meta.name || profileRecord.name,
      salt: databaseDump.meta.salt,
      verification: databaseDump.meta.verification,
      recovery: databaseDump.meta.recovery ?? backup.recovery,
      createdAt: databaseDump.meta.createdAt || profileRecord.createdAt,
    }
    await db.put('meta', restoredProfile, `profile_${profileId}`)

    const txDelete = db.transaction('platforms', 'readwrite')
    const allKeys = await txDelete.store.getAllKeys()
    const prefix = `${profileId}_`
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        await txDelete.store.delete(key)
      }
    }
    await txDelete.done

    const txWrite = db.transaction('platforms', 'readwrite')
    for (const record of importedRecords) {
      await txWrite.store.put(record.payload, `${profileId}_${record.id}`)
    }
    await txWrite.done
  }

  async inspectAndDecryptCloudPayload(payloadJson: string): Promise<{
    identities: any[]
    localItems: any[]
    localCategories: any[]
  }> {
    if (!this.vault.isUnlocked()) throw new Error('La bóveda debe estar desbloqueada para inspeccionar la nube.')

    const backup = JSON.parse(payloadJson)
    if (!backup.iv || !backup.data) throw new Error('Formato de datos en la nube no válido.')

    const decryptedString = await this.vault.decryptString({ v: backup.v || 1, iv: backup.iv, data: backup.data })
    const databaseDump = JSON.parse(decryptedString)
    const importedRecords = databaseDump.identities ?? databaseDump.platforms
    if (!Array.isArray(importedRecords)) throw new Error('El contenido descargado de la nube no tiene registros válidos.')

    const identities: any[] = []
    const localItems: any[] = []
    const localCategories: any[] = []

    for (const record of importedRecords) {
      if (typeof record?.id === 'string' && record.id.startsWith(LOCAL_ITEM_KEY_SEGMENT.slice(1))) {
        localItems.push(await this.vault.decryptJson(record.payload))
        continue
      }
      if (typeof record?.id === 'string' && record.id.startsWith(LOCAL_CATEGORY_KEY_SEGMENT.slice(1))) {
        localCategories.push(await this.vault.decryptJson(record.payload))
        continue
      }

      identities.push(normalizeIdentityRecord(await this.vault.decryptJson<unknown>(record.payload)))
    }

    return { identities, localItems, localCategories }
  }

  async inspectCloudPayloadWithActiveSession(payloadJson: string): Promise<{
    identityCount: number
    platformCount: number
    localItemCount: number
    localCategoryCount: number
    rawDump: any
  }> {
    if (!this.vault.isUnlocked()) {
      throw new Error('La bóveda debe estar desbloqueada para inspeccionar la nube.')
    }

    const backup = JSON.parse(payloadJson)
    if (!backup.iv || !backup.data) {
      throw new Error('Formato de datos en la nube no válido.')
    }

    const decryptedString = await this.vault.decryptString({
      v: backup.v || 1,
      iv: backup.iv,
      data: backup.data,
    })
    const databaseDump = JSON.parse(decryptedString)
    const importedRecords = databaseDump.identities ?? databaseDump.platforms
    if (!Array.isArray(importedRecords)) {
      throw new Error('El contenido descargado de la nube no tiene registros válidos.')
    }

    let identityCount = 0
    let platformCount = 0
    let localItemCount = 0
    let localCategoryCount = 0
    for (const record of importedRecords) {
      if (typeof record?.id === 'string' && record.id.startsWith(LOCAL_ITEM_KEY_SEGMENT.slice(1))) {
        localItemCount += 1
        continue
      }
      if (typeof record?.id === 'string' && record.id.startsWith(LOCAL_CATEGORY_KEY_SEGMENT.slice(1))) {
        localCategoryCount += 1
        continue
      }

      const identity = normalizeIdentityRecord(await this.vault.decryptJson<unknown>(record.payload))
      identityCount += 1
      platformCount += identity.platforms.length
    }

    return { identityCount, platformCount, localItemCount, localCategoryCount, rawDump: databaseDump }
  }

  async getUnencryptedCloudPayload(profileId: string): Promise<any> {
    if (!this.vault.isUnlocked()) {
      throw new Error('La bóveda debe estar desbloqueada para exportar.')
    }

    const db = await getVaultDb()
    const profileRecord = (await db.get('meta', `profile_${profileId}`)) as ProfileRecord | undefined
    if (!profileRecord) {
      return {
        meta: {
          salt: '',
          verification: { v: 1, iv: '', data: '' },
          createdAt: new Date().toISOString(),
          name: 'Bóveda Principal'
        },
        identities: []
      }
    }

    const tx = db.transaction('platforms', 'readonly')
    const allKeys = await tx.store.getAllKeys()
    const prefix = `${profileId}_`

    const identitiesData: { id: string; payload: EncryptedPayload }[] = []
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        const payload = await tx.store.get(key)
        if (payload) {
          try {
            const itemStr = await this.vault.decryptString(payload)
            const item = JSON.parse(itemStr)
            if (!item.isLocalOnly) {
              const platformId = key.substring(prefix.length)
              identitiesData.push({
                id: platformId,
                payload
              })
            }
          } catch (err) {
            console.error('Error decrypting item for cloud export', err)
          }
        }
      }
    }
    await tx.done

    return {
      meta: {
        salt: profileRecord.salt,
        verification: profileRecord.verification,
        createdAt: profileRecord.createdAt,
        name: profileRecord.name,
        recovery: profileRecord.recovery,
      },
      identities: identitiesData
    }
  }

  async recoverMasterPasswordFromCloudPayload(payloadJson: string, recoveryPhrase: string): Promise<string> {
    const backup = JSON.parse(payloadJson)
    const recovery = backup.recovery as RecoveryBundle | undefined
    if (!recovery) {
      throw new Error('La boveda en la nube no contiene kit de recuperacion.')
    }
    return CryptoVault.decryptRecoveryBundle(recoveryPhrase, recovery)
  }
  // ─── Biometric Bundle Storage ───────────────────────────────────────────────

  /**
   * Guarda un bundle biométrico (credencial + contraseña maestra cifrada) en IndexedDB.
   */
  async saveBiometricBundle(bundle: {
    profileId: string
    credentialId: string
    encryptedPassword: import('../crypto/types').EncryptedPayload
    createdAt: string
  }): Promise<void> {
    const db = await getVaultDb()
    await db.put('biometric_bundles', bundle, bundle.profileId)
  }

  /**
   * Carga el bundle biométrico para un perfil dado. Devuelve null si no existe.
   */
  async loadBiometricBundle(profileId: string): Promise<{
    profileId: string
    credentialId: string
    encryptedPassword: import('../crypto/types').EncryptedPayload
    createdAt: string
  } | null> {
    const db = await getVaultDb()
    const bundle = await db.get('biometric_bundles', profileId)
    return bundle ?? null
  }

  /**
   * Elimina el bundle biométrico de un perfil (para desactivar la biometría).
   */
  async deleteBiometricBundle(profileId: string): Promise<void> {
    const db = await getVaultDb()
    await db.delete('biometric_bundles', profileId)
  }

  /**
   * Comprueba si hay un bundle biométrico registrado para el perfil dado.
   */
  async hasBiometricBundle(profileId: string): Promise<boolean> {
    const db = await getVaultDb()
    const bundle = await db.get('biometric_bundles', profileId)
    return Boolean(bundle)
  }

}
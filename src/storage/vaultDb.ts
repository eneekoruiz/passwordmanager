import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { EncryptedPayload } from '../crypto/types'

const DB_NAME = 'contras-vault'
const DB_VERSION = 2

export interface StoredVaultMeta {
  salt: string
  createdAt: string
  verification: EncryptedPayload
  id?: string
  name?: string
}

export interface BiometricBundleRecord {
  profileId: string
  credentialId: string
  encryptedPassword: EncryptedPayload
  createdAt: string
}

interface ContrasDB extends DBSchema {
  meta: {
    key: string
    value: StoredVaultMeta
  }
  platforms: {
    key: string
    value: EncryptedPayload
  }
  biometric_bundles: {
    key: string  // profileId
    value: BiometricBundleRecord
  }
}

class InMemoryDB {
  private stores: Record<string, Map<any, any>> = {
    meta: new Map(),
    platforms: new Map(),
    biometric_bundles: new Map(),
  }

  async get(storeName: any, key: any): Promise<any> {
    return this.stores[storeName]?.get(key)
  }

  async put(storeName: any, value: any, key: any): Promise<any> {
    this.stores[storeName]?.set(key, value)
    return key
  }

  async delete(storeName: any, key: any): Promise<void> {
    this.stores[storeName]?.delete(key)
  }

  async getAllKeys(storeName: any): Promise<any[]> {
    return Array.from(this.stores[storeName]?.keys() || [])
  }

  transaction(storeName: any, _mode?: any): any {
    const storeMap = this.stores[storeName]
    const store = {
      async getAllKeys(): Promise<any[]> {
        return Array.from(storeMap?.keys() || [])
      },
      async get(key: any): Promise<any> {
        return storeMap?.get(key)
      },
      async put(value: any, key: any): Promise<any> {
        storeMap?.set(key, value)
        return key
      },
      async delete(key: any): Promise<void> {
        storeMap?.delete(key)
      },
      async clear(): Promise<void> {
        storeMap?.clear()
      },
    }
    return {
      store,
      done: Promise.resolve(),
    }
  }
}

let dbPromise: Promise<IDBPDatabase<ContrasDB>> | null = null
let inMemoryInstance: InMemoryDB | null = null
let isInMemory = false

export function isInMemoryFallbackActive(): boolean {
  return isInMemory
}

function openVaultDatabase(): Promise<IDBPDatabase<ContrasDB>> {
  return openDB<ContrasDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta')
      }
      if (!db.objectStoreNames.contains('platforms')) {
        db.createObjectStore('platforms')
      }
      if (!db.objectStoreNames.contains('biometric_bundles')) {
        db.createObjectStore('biometric_bundles')
      }
    },
  })
}

async function openVaultDatabaseWithRetries(): Promise<IDBPDatabase<ContrasDB>> {
  let attempt = 0
  const maxAttempts = 3
  let delay = 100

  while (attempt < maxAttempts) {
    try {
      return await openVaultDatabase()
    } catch (error) {
      attempt++
      console.warn(`Intento ${attempt} de abrir IndexedDB fallo:`, error)
      if (attempt >= maxAttempts) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, delay))
      delay *= 2
    }
  }
  throw new Error('IndexedDB no se pudo abrir tras varios intentos.')
}

export function getVaultDb(): Promise<IDBPDatabase<ContrasDB>> {
  if (isInMemory && inMemoryInstance) {
    return Promise.resolve(inMemoryInstance as unknown as IDBPDatabase<ContrasDB>)
  }

  if (!dbPromise) {
    dbPromise = openVaultDatabaseWithRetries().catch(async (err) => {
      console.error('Error inicializando IndexedDB. Intentando recuperar...', err)
      dbPromise = null

      try {
        await deleteDB(DB_NAME)
        return await openVaultDatabaseWithRetries()
      } catch (recoveryErr) {
        console.error('No se pudo recuperar IndexedDB de forma persistente. Activando persistencia degradada in-memory:', recoveryErr)
        isInMemory = true
        inMemoryInstance = new InMemoryDB()
        dbPromise = null
        return inMemoryInstance as unknown as IDBPDatabase<ContrasDB>
      }
    })
  }
  return dbPromise
}

export async function deleteVaultDb(): Promise<void> {
  dbPromise = null
  if (isInMemory && inMemoryInstance) {
    inMemoryInstance = new InMemoryDB()
    return
  }
  try {
    await deleteDB(DB_NAME)
  } catch (error) {
    console.warn('No se pudo borrar IndexedDB fisica, reiniciando adaptador in-memory:', error)
    isInMemory = true
    inMemoryInstance = new InMemoryDB()
  }
}

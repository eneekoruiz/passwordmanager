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

let inMemoryInstance: InMemoryDB | null = null
let isInMemory = false
let wrapperPromise: Promise<IDBPDatabase<ContrasDB>> | null = null

export function isInMemoryFallbackActive(): boolean {
  return isInMemory
}

function handleStorageError(error: any) {
  if (isInMemory) return
  console.warn('Safari/WebKit storage restriction detected. Switching to volatile in-memory fallback:', error)
  isInMemory = true
  if (!inMemoryInstance) {
    inMemoryInstance = new InMemoryDB()
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('contras:storage-degraded', { detail: error }))
  }
}

function wrapTransaction(tx: any, storeName: string, mode: any) {
  const store = {
    async getAllKeys() {
      if (isInMemory && inMemoryInstance) {
        const memTx = inMemoryInstance.transaction(storeName, mode)
        return memTx.store.getAllKeys()
      }
      try {
        return await tx.store.getAllKeys()
      } catch (error) {
        handleStorageError(error)
        const memTx = inMemoryInstance!.transaction(storeName, mode)
        return memTx.store.getAllKeys()
      }
    },
    async get(key: any) {
      if (isInMemory && inMemoryInstance) {
        const memTx = inMemoryInstance.transaction(storeName, mode)
        return memTx.store.get(key)
      }
      try {
        return await tx.store.get(key)
      } catch (error) {
        handleStorageError(error)
        const memTx = inMemoryInstance!.transaction(storeName, mode)
        return memTx.store.get(key)
      }
    },
    async put(value: any, key: any) {
      if (isInMemory && inMemoryInstance) {
        const memTx = inMemoryInstance.transaction(storeName, mode)
        return memTx.store.put(value, key)
      }
      try {
        return await tx.store.put(value, key)
      } catch (error) {
        handleStorageError(error)
        const memTx = inMemoryInstance!.transaction(storeName, mode)
        return memTx.store.put(value, key)
      }
    },
    async delete(key: any) {
      if (isInMemory && inMemoryInstance) {
        const memTx = inMemoryInstance.transaction(storeName, mode)
        return memTx.store.delete(key)
      }
      try {
        return await tx.store.delete(key)
      } catch (error) {
        handleStorageError(error)
        const memTx = inMemoryInstance!.transaction(storeName, mode)
        return memTx.store.delete(key)
      }
    },
    async clear() {
      if (isInMemory && inMemoryInstance) {
        const memTx = inMemoryInstance.transaction(storeName, mode)
        return memTx.store.clear()
      }
      try {
        return await tx.store.clear()
      } catch (error) {
        handleStorageError(error)
        const memTx = inMemoryInstance!.transaction(storeName, mode)
        return memTx.store.clear()
      }
    },
  }

  return {
    store,
    get done() {
      if (isInMemory) {
        return Promise.resolve()
      }
      return tx.done.catch((error: any) => {
        handleStorageError(error)
        return Promise.resolve()
      })
    },
  }
}

class SafeDatabaseWrapper {
  constructor(private db: IDBPDatabase<ContrasDB> | InMemoryDB) {}

  async get(storeName: any, key: any): Promise<any> {
    if (isInMemory) {
      return (this.db as InMemoryDB).get(storeName, key)
    }
    try {
      return await (this.db as IDBPDatabase<ContrasDB>).get(storeName, key)
    } catch (error) {
      handleStorageError(error)
      this.db = inMemoryInstance!
      return this.db.get(storeName, key)
    }
  }

  async put(storeName: any, value: any, key: any): Promise<any> {
    if (isInMemory) {
      return (this.db as InMemoryDB).put(storeName, value, key)
    }
    try {
      return await (this.db as IDBPDatabase<ContrasDB>).put(storeName, value, key)
    } catch (error) {
      handleStorageError(error)
      this.db = inMemoryInstance!
      return this.db.put(storeName, value, key)
    }
  }

  async delete(storeName: any, key: any): Promise<void> {
    if (isInMemory) {
      return (this.db as InMemoryDB).delete(storeName, key)
    }
    try {
      return await (this.db as IDBPDatabase<ContrasDB>).delete(storeName, key)
    } catch (error) {
      handleStorageError(error)
      this.db = inMemoryInstance!
      return this.db.delete(storeName, key)
    }
  }

  async getAllKeys(storeName: any): Promise<any[]> {
    if (isInMemory) {
      return (this.db as InMemoryDB).getAllKeys(storeName)
    }
    try {
      return await (this.db as IDBPDatabase<ContrasDB>).getAllKeys(storeName)
    } catch (error) {
      handleStorageError(error)
      this.db = inMemoryInstance!
      return this.db.getAllKeys(storeName)
    }
  }

  transaction(storeName: any, mode?: any): any {
    if (isInMemory) {
      return (this.db as InMemoryDB).transaction(storeName, mode)
    }
    try {
      const tx = (this.db as IDBPDatabase<ContrasDB>).transaction(storeName, mode)
      return wrapTransaction(tx, storeName, mode)
    } catch (error) {
      handleStorageError(error)
      this.db = inMemoryInstance!
      return this.db.transaction(storeName, mode)
    }
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ])
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
      return await withTimeout(
        openVaultDatabase(),
        2500,
        'La apertura de la base de datos IndexedDB excedió el tiempo límite (2.5s).'
      )
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
    return Promise.resolve(new SafeDatabaseWrapper(inMemoryInstance) as unknown as IDBPDatabase<ContrasDB>)
  }

  if (!wrapperPromise) {
    wrapperPromise = (async () => {
      try {
        const physicalDb = await openVaultDatabaseWithRetries()
        return new SafeDatabaseWrapper(physicalDb) as unknown as IDBPDatabase<ContrasDB>
      } catch (err) {
        console.error('Error inicializando IndexedDB. Intentando recuperar...', err)
        try {
          await withTimeout(deleteDB(DB_NAME), 2000, 'El borrado de IndexedDB excedió el tiempo límite (2s).')
          const physicalDb = await openVaultDatabaseWithRetries()
          return new SafeDatabaseWrapper(physicalDb) as unknown as IDBPDatabase<ContrasDB>
        } catch (recoveryErr) {
          console.error('No se pudo recuperar IndexedDB de forma persistente. Activando persistencia degradada in-memory:', recoveryErr)
          handleStorageError(recoveryErr)
          return new SafeDatabaseWrapper(inMemoryInstance!) as unknown as IDBPDatabase<ContrasDB>
        }
      }
    })()
  }
  return wrapperPromise
}

export async function deleteVaultDb(): Promise<void> {
  wrapperPromise = null
  if (isInMemory && inMemoryInstance) {
    inMemoryInstance = new InMemoryDB()
    return
  }
  try {
    await deleteDB(DB_NAME)
  } catch (error) {
    console.warn('No se pudo borrar IndexedDB fisica, reiniciando adaptador in-memory:', error)
    handleStorageError(error)
  }
}

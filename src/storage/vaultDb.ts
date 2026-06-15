import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { EncryptedPayload } from '../crypto/types'

const DB_NAME = 'contras-vault'
const DB_VERSION = 1

export interface StoredVaultMeta {
  salt: string
  createdAt: string
  verification: EncryptedPayload
  id?: string
  name?: string
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
}

let dbPromise: Promise<IDBPDatabase<ContrasDB>> | null = null

function openVaultDatabase(): Promise<IDBPDatabase<ContrasDB>> {
  return openDB<ContrasDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta')
      }
      if (!db.objectStoreNames.contains('platforms')) {
        db.createObjectStore('platforms')
      }
    },
  })
}

export function getVaultDb(): Promise<IDBPDatabase<ContrasDB>> {
  if (!dbPromise) {
    dbPromise = openVaultDatabase().catch(async () => {
      dbPromise = null
      await deleteDB(DB_NAME)

      try {
        return await openVaultDatabase()
      } catch {
        throw new Error(
          'IndexedDB no pudo recuperarse automaticamente. Reinicia el navegador o prueba con otro perfil.',
        )
      }
    })
  }
  return dbPromise
}

export async function deleteVaultDb(): Promise<void> {
  dbPromise = null
  await deleteDB(DB_NAME)
}

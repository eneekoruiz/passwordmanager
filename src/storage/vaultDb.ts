import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
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

export function getVaultDb(): Promise<IDBPDatabase<ContrasDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ContrasDB>(DB_NAME, DB_VERSION, {
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
  return dbPromise
}

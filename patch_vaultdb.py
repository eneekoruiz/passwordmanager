with open('src/storage/vaultDb.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_db_version = "const DB_VERSION = 1"
new_db_version = "const DB_VERSION = 2"

old_schema = """interface ContrasDB extends DBSchema {
  meta: {
    key: string
    value: StoredVaultMeta
  }
  platforms: {
    key: string
    value: EncryptedPayload
  }
}"""

new_schema = """export interface BiometricBundleRecord {
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
}"""

old_upgrade = """    upgrade(db) {
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta')
      }
      if (!db.objectStoreNames.contains('platforms')) {
        db.createObjectStore('platforms')
      }
    },"""

new_upgrade = """    upgrade(db) {
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta')
      }
      if (!db.objectStoreNames.contains('platforms')) {
        db.createObjectStore('platforms')
      }
      if (!db.objectStoreNames.contains('biometric_bundles')) {
        db.createObjectStore('biometric_bundles')
      }
    },"""

content = content.replace(old_db_version, new_db_version)
content = content.replace(old_schema, new_schema)
content = content.replace(old_upgrade, new_upgrade)

with open('src/storage/vaultDb.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("vaultDb.ts patched.")

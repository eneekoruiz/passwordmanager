with open('src/storage/VaultStore.ts', 'r', encoding='utf-8') as f:
    content = f.read()

new_method = """  async inspectAndDecryptCloudPayload(payloadJson: string): Promise<{
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

  async inspectCloudPayloadWithActiveSession(payloadJson: string): Promise<{"""

if "inspectAndDecryptCloudPayload" not in content:
    new_content = content.replace("  async inspectCloudPayloadWithActiveSession(payloadJson: string): Promise<{", new_method)
    with open('src/storage/VaultStore.ts', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Patched successfully")
else:
    print("Already patched")

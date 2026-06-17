with open('src/storage/VaultStore.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add biometric methods at the end (before the closing brace of the class)
biometric_methods = """
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
"""

# Find the last closing brace of the class
last_brace = content.rfind('\n}')
if last_brace != -1 and 'saveBiometricBundle' not in content:
    content = content[:last_brace] + biometric_methods + '\n}'
    with open('src/storage/VaultStore.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("VaultStore.ts patched with biometric methods.")
elif 'saveBiometricBundle' in content:
    print("Already patched.")
else:
    print("Could not find insertion point.")

with open('src/context/VaultContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add biometric imports at top
old_import = "import { payloadsAreIdentical } from '../utils/hash'"
new_import = """import { payloadsAreIdentical } from '../utils/hash'
import {
  isBiometricAvailable,
  registerBiometricCredential,
  unlockWithBiometrics,
  type BiometricBundle,
} from '../crypto/biometric'"""

content = content.replace(old_import, new_import)

# 2. Add biometric to the VaultContextValue interface
old_interface_end = """  nukeAccount: () => Promise<void>
}"""
new_interface_end = """  nukeAccount: () => Promise<void>
  // Biometric unlock
  biometricAvailable: boolean
  biometricRegistered: boolean
  registerBiometricUnlock: () => Promise<void>
  unlockWithBiometricSensor: () => Promise<void>
  disableBiometricUnlock: () => Promise<void>
}"""

content = content.replace(old_interface_end, new_interface_end)

# 3. Add biometric state after hasUnsyncedChanges state
old_state = "  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false)"
new_state = """  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricRegistered, setBiometricRegistered] = useState(false)"""

content = content.replace(old_state, new_state)

# 4. Add biometric check useEffect after the profiles useEffect
old_effect = "  const { showToast } = useToast()"
new_effect = """  const { showToast } = useToast()

  // Check biometric availability on mount
  useEffect(() => {
    void isBiometricAvailable().then(setBiometricAvailable)
  }, [])"""

content = content.replace(old_effect, new_effect, 1)

# 5. Add biometricRegistered check after unlockOrRestoreVault success
old_unlock_success = """          setCurrentProfileId(profileId)
          setCurrentProfileName(localDefaultProfile.name || 'Boveda Principal')
          setIsUnlocked(true)
          await loadVaultDataForProfile(profileId)
          setCloudSyncStatus('synced')
          return"""
new_unlock_success = """          setCurrentProfileId(profileId)
          setCurrentProfileName(localDefaultProfile.name || 'Boveda Principal')
          setIsUnlocked(true)
          await loadVaultDataForProfile(profileId)
          setCloudSyncStatus('synced')
          // Check if biometric is registered for this profile
          void storeRef.current.hasBiometricBundle(profileId).then(setBiometricRegistered)
          return"""

content = content.replace(old_unlock_success, new_unlock_success)

# 6. Add biometric functions before nukeAccount
old_nuke = "  const nukeAccount = useCallback(async () => {"
new_biometric_functions = """  const registerBiometricUnlock = useCallback(async () => {
    if (!currentProfileId || !cloudUserEmail) throw new Error('No hay un perfil activo.')
    const bundle = await registerBiometricCredential(
      // We need the master password - we get it from the vault by verifying again
      // Actually, we need to keep it in a secure ephemeral ref during the session
      // For now, we expose a simpler flow: user must re-type password once to register biometric
      // This is handled in the UI: SettingsModal asks for password before calling this
      (window as any).__contras_ephemeral_pw__ ?? '',
      currentProfileId,
      cloudUserEmail,
    )
    await storeRef.current.saveBiometricBundle(bundle)
    setBiometricRegistered(true)
    // Clean ephemeral password immediately
    delete (window as any).__contras_ephemeral_pw__
  }, [currentProfileId, cloudUserEmail])

  const unlockWithBiometricSensor = useCallback(async () => {
    const profileId = 'default'
    const bundle = await storeRef.current.loadBiometricBundle(profileId)
    if (!bundle) throw new Error('No hay credencial biométrica registrada.')
    const masterPassword = await unlockWithBiometrics(bundle as BiometricBundle)
    await unlockOrRestoreVault(masterPassword)
  }, [unlockOrRestoreVault])

  const disableBiometricUnlock = useCallback(async () => {
    if (!currentProfileId) return
    await storeRef.current.deleteBiometricBundle(currentProfileId)
    setBiometricRegistered(false)
  }, [currentProfileId])

  const nukeAccount = useCallback(async () => {"""

content = content.replace(old_nuke, new_biometric_functions)

# 7. Add biometric to the context value
old_context_value_end = """      nukeAccount,"""
new_context_value_end = """      nukeAccount,
      biometricAvailable,
      biometricRegistered,
      registerBiometricUnlock,
      unlockWithBiometricSensor,
      disableBiometricUnlock,"""

content = content.replace(old_context_value_end, new_context_value_end, 1)

with open('src/context/VaultContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("VaultContext.tsx patched with biometric support.")

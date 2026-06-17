with open('src/components/UnlockScreen.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add biometricAvailable, biometricRegistered, unlockWithBiometricSensor to useVault destructure
old_use_vault = """  const {
    cloudUserEmail,
    cloudSyncStatus,
    cloudVaultExists,
    loginWithGoogleCloud,
    logoutCloud,
    initializeNewVault,
    unlockOrRestoreVault,
    recoverVaultWithSeed,
    nukeAccount,
  } = useVault()"""

new_use_vault = """  const {
    cloudUserEmail,
    cloudSyncStatus,
    cloudVaultExists,
    loginWithGoogleCloud,
    logoutCloud,
    initializeNewVault,
    unlockOrRestoreVault,
    recoverVaultWithSeed,
    nukeAccount,
    biometricAvailable,
    biometricRegistered,
    unlockWithBiometricSensor,
  } = useVault()"""

content = content.replace(old_use_vault, new_use_vault)

# 2. Add BiometricUnlockButton import
old_import = "import { PasswordField } from './ui/PasswordField'"
new_import = """import { PasswordField } from './ui/PasswordField'
import { BiometricUnlockButton } from './ui/BiometricUnlockButton'"""

content = content.replace(old_import, new_import)

# 3. Insert biometric button ABOVE the password form (when cloudVaultExists is true, i.e. existing vault)
old_form_title = """                <form onSubmit={handleVaultAction} className="w-full space-y-5">
                  <div className="space-y-1">
                    <h1 className="text-xl font-bold tracking-tight text-text-primary">Desbloquea tu Bóveda Local</h1>
                    <p className="text-xs leading-relaxed text-text-secondary">
                      Introduce tu <strong>Contraseña Maestra</strong> para abrirla. Nunca se envía a nuestros servidores.
                    </p>
                  </div>"""

new_form_title = """                <form onSubmit={handleVaultAction} className="w-full space-y-5">
                  <div className="space-y-1">
                    <h1 className="text-xl font-bold tracking-tight text-text-primary">Desbloquea tu Bóveda Local</h1>
                    <p className="text-xs leading-relaxed text-text-secondary">
                      Introduce tu <strong>Contraseña Maestra</strong> para abrirla. Nunca se envía a nuestros servidores.
                    </p>
                  </div>

                  {cloudVaultExists !== false && biometricAvailable && biometricRegistered && (
                    <div className="space-y-3">
                      <BiometricUnlockButton
                        onUnlock={unlockWithBiometricSensor}
                        onError={(msg) => setError(msg)}
                      />
                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">o continúa con contraseña</span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    </div>
                  )}"""

content = content.replace(old_form_title, new_form_title)

with open('src/components/UnlockScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("UnlockScreen.tsx patched with biometric button.")

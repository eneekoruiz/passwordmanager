with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add biometric to useVault destructure in App.tsx
old_import_vault = """    hasUnsyncedChanges,
    triggerCloudSync,"""
new_import_vault = """    hasUnsyncedChanges,
    triggerCloudSync,
    biometricAvailable,
    biometricRegistered,
    registerBiometricUnlock,
    disableBiometricUnlock,"""

content = content.replace(old_import_vault, new_import_vault, 1)

# 2. Add handleRegisterBiometric function before handleManualSync
old_handle_sync = "  const handleManualSync = async () => {"
new_handle_biometric = """  const handleRegisterBiometric = async (masterPassword: string) => {
    // Store ephemerally so the biometric module can access it
    ;(window as any).__contras_ephemeral_pw__ = masterPassword
    try {
      await registerBiometricUnlock()
      showToast('Biometría activada correctamente. Ya puedes desbloquear con tu sensor.', 'info')
    } finally {
      delete (window as any).__contras_ephemeral_pw__
    }
  }

  const handleManualSync = async () => {"""
content = content.replace(old_handle_sync, new_handle_biometric, 1)

# 3. Add biometric props to the first SettingsModal (mobile sidebar variant, line ~708)
old_settings_modal_1 = """        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onExport={handleExportBackup}
          identities={identities}
          localItems={localItems}
          onVerifyMasterPassword={verifyCurrentMasterPassword}
          onChangeMasterPassword={changeCurrentMasterPassword}
          travelModeEnabled={travelModeEnabled}
          onEnableTravelMode={enableTravelMode}
          onDisableTravelMode={disableTravelMode}
          onImport={handleImportBackup}
          onOpenImportText={() => setImportTextOpen(true)}
        />"""

new_settings_modal_1 = """        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onExport={handleExportBackup}
          identities={identities}
          localItems={localItems}
          onVerifyMasterPassword={verifyCurrentMasterPassword}
          onChangeMasterPassword={changeCurrentMasterPassword}
          travelModeEnabled={travelModeEnabled}
          onEnableTravelMode={enableTravelMode}
          onDisableTravelMode={disableTravelMode}
          onImport={handleImportBackup}
          onOpenImportText={() => setImportTextOpen(true)}
          biometricAvailable={biometricAvailable}
          biometricRegistered={biometricRegistered}
          onRegisterBiometric={handleRegisterBiometric}
          onDisableBiometric={disableBiometricUnlock}
        />"""
content = content.replace(old_settings_modal_1, new_settings_modal_1)

# 4. Find the second SettingsModal (around line 879) and patch similarly
# Look for its pattern specifically
import re
def replace_second_settings_modal(text):
    pattern = r'(<SettingsModal\n\s+isOpen={settingsOpen}\n\s+onClose=\{[^}]+\}\n\s+onExport=\{[^}]+\}\n\s+identities=\{[^}]+\}\n\s+localItems=\{[^}]+\}\n\s+onVerifyMasterPassword=\{[^}]+\}\n\s+onChangeMasterPassword=\{[^}]+\}\n\s+travelModeEnabled=\{[^}]+\}\n\s+onEnableTravelMode=\{[^}]+\}\n\s+onDisableTravelMode=\{[^}]+\}\n\s+onImport=\{[^}]+\}\n\s+onOpenImportText=\{[^\}]+\}\n\s+/>)'
    matches = list(re.finditer(pattern, text))
    return len(matches)

# Simply do a replace on remaining occurrence (after first was replaced)
# Already replaced once, search for remaining occurrence
remaining = content.count('onOpenImportText={() => setImportTextOpen(true)}\n        />')
print(f"Remaining SettingsModal occurrences: {remaining}")

if remaining > 0:
    old_settings_modal_2 = """          onOpenImportText={() => setImportTextOpen(true)}
        />"""
    new_settings_modal_2 = """          onOpenImportText={() => setImportTextOpen(true)}
          biometricAvailable={biometricAvailable}
          biometricRegistered={biometricRegistered}
          onRegisterBiometric={handleRegisterBiometric}
          onDisableBiometric={disableBiometricUnlock}
        />"""
    content = content.replace(old_settings_modal_2, new_settings_modal_2)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("App.tsx patched with biometric hooks.")

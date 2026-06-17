with open('src/components/SettingsModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add biometric props to interface
old_props_interface = """  onImport: (backupJsonString: string, masterPassword: string) => Promise<void>
  onOpenImportText: () => void
}"""
new_props_interface = """  onImport: (backupJsonString: string, masterPassword: string) => Promise<void>
  onOpenImportText: () => void
  biometricAvailable?: boolean
  biometricRegistered?: boolean
  onRegisterBiometric?: (masterPassword: string) => Promise<void>
  onDisableBiometric?: () => Promise<void>
}"""
content = content.replace(old_props_interface, new_props_interface)

# 2. Add biometric to destructure
old_destructure = """  onImport,
  onOpenImportText,
}: SettingsModalProps) {"""
new_destructure = """  onImport,
  onOpenImportText,
  biometricAvailable = false,
  biometricRegistered = false,
  onRegisterBiometric,
  onDisableBiometric,
}: SettingsModalProps) {"""
content = content.replace(old_destructure, new_destructure)

# 3. Add biometric state
old_loading_state = "  const [loadingTravelMode, setLoadingTravelMode] = useState(false)"
new_loading_state = """  const [loadingTravelMode, setLoadingTravelMode] = useState(false)
  const [loadingBiometric, setLoadingBiometric] = useState(false)
  const [biometricPassword, setBiometricPassword] = useState('')
  const [biometricMessage, setBiometricMessage] = useState<string | null>(null)
  const [biometricError, setBiometricError] = useState<string | null>(null)"""
content = content.replace(old_loading_state, new_loading_state)

# 4. Add 'biometric' to view type union
old_view_type = "  const [view, setView] = useState<'main' | 'health' | 'travel' | 'credentials' | 'exportPlaintext' | 'exportBackup' | 'importBackup'>('main')"
new_view_type = "  const [view, setView] = useState<'main' | 'health' | 'travel' | 'credentials' | 'exportPlaintext' | 'exportBackup' | 'importBackup' | 'biometric'>('main')"
content = content.replace(old_view_type, new_view_type)

# 5. Add biometric view title
old_view_title_importBackup = "                {view === 'importBackup' && 'Restaurar Copia'}"
new_view_title_importBackup = """                {view === 'importBackup' && 'Restaurar Copia'}
                {view === 'biometric' && 'Biometría'}"""
content = content.replace(old_view_title_importBackup, new_view_title_importBackup)

# 6. Add biometric menu item after "Credenciales y Recuperación"
old_menu_credentials = """                <MenuItem
                  title="Credenciales y Recuperación"
                  subtitle="Cambia tu Contraseña Maestra local."
                  onClick={() => setView('credentials')}
                />
                
                <div className="pt-2">"""
new_menu_credentials = """                <MenuItem
                  title="Credenciales y Recuperación"
                  subtitle="Cambia tu Contraseña Maestra local."
                  onClick={() => setView('credentials')}
                />
                {biometricAvailable && (
                  <MenuItem
                    title={biometricRegistered ? '🔒 Biometría Activada' : '🔓 Activar Biometría'}
                    subtitle={biometricRegistered ? 'Face ID · Huella · Windows Hello activos.' : 'Desbloquea sin contraseña con tu sensor biométrico.'}
                    onClick={() => { setBiometricMessage(null); setBiometricError(null); setBiometricPassword(''); setView('biometric') }}
                  />
                )}
                
                <div className="pt-2">"""
content = content.replace(old_menu_credentials, new_menu_credentials)

# 7. Add biometric view section before the closing })} of main view
old_close_views = "          {view === 'health' && ("
new_biometric_view = """          {view === 'biometric' && (
            <div className="space-y-4 animate-vault-morph">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-xs font-bold text-blue-900">¿Cómo funciona?</p>
                <p className="mt-1 text-[11px] leading-relaxed text-blue-800">
                  Tu Contraseña Maestra se cifra con una clave derivada de tu sensor biométrico (Face ID, huella o Windows Hello) y se guarda <strong>solo en este dispositivo</strong>. Nunca sale de él.
                </p>
              </div>
              {biometricRegistered ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-900">Biometría activa</p>
                      <p className="text-[11px] text-emerald-700">Puedes desbloquear con tu sensor en este dispositivo.</p>
                    </div>
                  </div>
                  {biometricMessage && <p className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs font-semibold text-emerald-800">{biometricMessage}</p>}
                  {biometricError && <p className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-semibold text-red-700">{biometricError}</p>}
                  <button
                    type="button"
                    disabled={loadingBiometric}
                    onClick={async () => {
                      setLoadingBiometric(true)
                      setBiometricError(null)
                      setBiometricMessage(null)
                      try {
                        await onDisableBiometric?.()
                        setBiometricMessage('Biometría desactivada. Elimina el acceso biométrico de los ajustes del dispositivo si lo deseas.')
                        setView('main')
                      } catch (err) {
                        setBiometricError(err instanceof Error ? err.message : 'Error al desactivar la biometría.')
                      } finally {
                        setLoadingBiometric(false)
                      }
                    }}
                    className="flex w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                  >
                    {loadingBiometric ? 'Desactivando...' : 'Desactivar biometría'}
                  </button>
                </div>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!biometricPassword) { setBiometricError('Introduce tu Contraseña Maestra para continuar.'); return }
                    setLoadingBiometric(true)
                    setBiometricError(null)
                    setBiometricMessage(null)
                    try {
                      await onRegisterBiometric?.(biometricPassword)
                      setBiometricPassword('')
                      setBiometricMessage('¡Biometría activada! La próxima vez que abras la app, podrás desbloquear con tu sensor.')
                      setView('main')
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Error al activar la biometría.'
                      setBiometricError(msg)
                    } finally {
                      setLoadingBiometric(false)
                    }
                  }}
                >
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
                      Confirma tu Contraseña Maestra
                    </label>
                    <input
                      type="password"
                      value={biometricPassword}
                      onChange={(e) => setBiometricPassword(e.target.value)}
                      placeholder="Contraseña Maestra"
                      className="w-full rounded-xl border border-black/[0.06] bg-white/80 px-3 py-2.5 text-sm text-text-primary outline-none transition-all focus:border-black/15 focus:ring-2 focus:ring-black/[0.035]"
                      autoComplete="current-password"
                    />
                    <p className="mt-1.5 text-[11px] text-text-tertiary">Solo se usa para cifrar tu clave en este dispositivo. No se guarda en ningún servidor.</p>
                  </div>
                  {biometricError && <p className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-semibold text-red-700">{biometricError}</p>}
                  <button
                    type="submit"
                    disabled={loadingBiometric || !biometricPassword}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-50"
                  >
                    {loadingBiometric ? 'Registrando sensor...' : 'Activar con mi sensor biométrico'}
                  </button>
                </form>
              )}
            </div>
          )}

          {view === 'health' && ("""

content = content.replace(old_close_views, new_biometric_view)

# 8. Also clear biometricPassword on cleanup
old_cleanup = "      setTravelPassword('')"
new_cleanup = """      setTravelPassword('')
      setBiometricPassword('')"""
content = content.replace(old_cleanup, new_cleanup)

with open('src/components/SettingsModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("SettingsModal.tsx patched with biometric section.")

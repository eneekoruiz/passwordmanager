import { useState, useEffect, type FormEvent } from 'react'
import { useVault } from '../context/VaultContext'
import { PasswordField } from './ui/PasswordField'

/**
 * Pantalla de inicio de sesión y desbloqueo en 2 Pasos con estilo Apple.
 * Paso 1: Autenticación en la Nube (BaaS).
 * Paso 2: Desbloqueo de Bóveda Local (Cifrado PBKDF2 / AES-GCM Zero-Knowledge).
 */
export function UnlockScreen() {
  const {
    cloudUserEmail,
    cloudSyncStatus,
    cloudError,
    cloudVaultExists,
    loginCloud,
    registerCloud,
    loginWithGoogleCloud,
    logoutCloud,
    initializeNewVault,
    unlockOrRestoreVault,
  } = useVault()

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [masterPassword, setMasterPassword] = useState('')
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Sync error handling from VaultContext
  useEffect(() => {
    if (cloudError) {
      setError(cloudError)
    }
  }, [cloudError])

  // Scrubbing: Limpieza de contraseñas de memoria al desmontar
  useEffect(() => {
    return () => {
      setEmail('')
      setPassword('')
      setMasterPassword('')
      setConfirmMasterPassword('')
    }
  }, [])

  const handleCloudAuth = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (authMode === 'login') {
        await loginCloud(email.trim(), password)
      } else {
        if (password.length < 6) {
          setError('La contraseña de la cuenta debe tener al menos 6 caracteres.')
          setLoading(false)
          return
        }
        await registerCloud(email.trim(), password)
      }
    } catch (err: any) {
      setError(err.message || 'Error de autenticación.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setError(null)
    setLoading(true)
    try {
      await loginWithGoogleCloud()
    } catch (err: any) {
      setError(err.message || 'Error al conectar con Google.')
    } finally {
      setLoading(false)
    }
  }

  const handleVaultAction = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!masterPassword) {
      setError('Por favor, introduce tu contraseña maestra.')
      return
    }

    setLoading(true)
    try {
      if (cloudVaultExists === false) {
        // Escenario A: Crear nueva bóveda
        if (masterPassword.length < 8) {
          setError('La contraseña maestra debe tener al menos 8 caracteres.')
          setLoading(false)
          return
        }
        if (masterPassword !== confirmMasterPassword) {
          setError('Las contraseñas no coinciden.')
          setLoading(false)
          return
        }
        await initializeNewVault(masterPassword)
      } else {
        // Escenario B: Desbloquear o restaurar existente
        await unlockOrRestoreVault(masterPassword)
      }
    } catch (err: any) {
      setError(err.message || 'Error con la contraseña maestra.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setError(null)
    setLoading(true)
    try {
      await logoutCloud()
      // Limpiar estados de contraseña maestra
      setMasterPassword('')
      setConfirmMasterPassword('')
    } catch (err: any) {
      setError(err.message || 'Error al cerrar sesión.')
    } finally {
      setLoading(false)
    }
  }

  const isCloudLoading = cloudSyncStatus === 'syncing'

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-8 select-none">
      <div className="w-full max-w-md bg-white/70 backdrop-blur-xl border border-black/5 rounded-3xl p-6 sm:p-8 shadow-[0_15px_50px_rgba(0,0,0,0.06)] animate-fade-in text-center flex flex-col items-center">
        
        {/* Cabecera común */}
        <header className="mb-6 relative w-full">
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Contras</h1>
          <p className="text-xs text-text-tertiary mt-1 font-medium">Bóveda Cifrada Zero-Knowledge</p>
        </header>

        {/* Paso 1: Autenticación en la Nube */}
        {cloudUserEmail === null ? (
          <div className="w-full space-y-5">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-text-primary">
                {authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta en la Nube'}
              </h2>
              <p className="text-xs text-text-secondary">
                {authMode === 'login'
                  ? 'Accede a la nube para descargar tu base de datos cifrada.'
                  : 'Sincroniza tus contraseñas cifradas automáticamente entre tus dispositivos.'}
              </p>
            </div>

            <form onSubmit={handleCloudAuth} className="w-full space-y-4">
              <div className="text-left space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary mb-1 uppercase tracking-wider">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-black/5 bg-surface-elevated hover:bg-surface-hover focus:bg-surface-elevated px-3.5 py-3 text-xs text-text-primary outline-none focus:border-border transition-all font-medium shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-secondary mb-1 uppercase tracking-wider">
                    Contraseña de la Cuenta
                  </label>
                  <input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-black/5 bg-surface-elevated hover:bg-surface-hover focus:bg-surface-elevated px-3.5 py-3 text-xs text-text-primary outline-none focus:border-border transition-all font-medium shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-start gap-2 text-left font-medium leading-normal animate-shake">
                  <svg className="h-4 w-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || isCloudLoading || !email.trim() || !password}
                className="w-full rounded-xl bg-text-primary py-3 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 active:scale-[0.98] duration-100 flex items-center justify-center gap-2"
              >
                {loading || isCloudLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Conectando con la nube...
                  </>
                ) : (
                  authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta y Continuar'
                )}
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-black/[0.06]"></div>
              <span className="flex-shrink mx-3 text-[9px] text-text-tertiary font-bold uppercase tracking-wider">O también</span>
              <div className="flex-grow border-t border-black/[0.06]"></div>
            </div>

            <button
              type="button"
              disabled={loading || isCloudLoading}
              onClick={handleGoogleAuth}
              className="w-full rounded-xl border border-black/10 bg-white hover:bg-surface-hover py-3 text-xs font-semibold text-text-primary transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading || isCloudLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-text-secondary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Conectando con Google...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.57h3.29c1.92,-1.77 3.02,-4.38 3.02,-7.42C21.65,11.83 21.54,11.41 21.35,11.1z" fill="#4285F4" />
                    <path d="M12,20.62c2.6,0 4.78,-0.86 6.37,-2.33l-3.29,-2.57c-0.91,0.61 -2.08,0.97 -3.08,0.97 -2.37,0 -4.38,-1.6 -5.1,-3.75H3.5v2.66C5.09,18.88 8.35,20.62 12,20.62z" fill="#34A853" />
                    <path d="M6.9,12.94a5.07,5.07 0 0 1 0,-1.88V8.4H3.5a8.77,8.77 0 0 0 0,7.2v-2.66z" fill="#FBBC05" />
                    <path d="M12,6.38c1.41,0 2.68,0.49 3.68,1.44L17.72,5.8C16.13,4.32 13.95,3.38 12,3.38 8.35,3.38 5.09,5.12 3.5,8.4L6.9,11.06C7.62,8.91 9.63,6.38 12,6.38z" fill="#EA4335" />
                  </svg>
                  Continuar con Google
                </>
              )}
            </button>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'))
                }}
                className="text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors active:scale-95 duration-100"
              >
                {authMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
              </button>
            </div>
          </div>
        ) : (
          /* Paso 2: Autenticación de Bóveda Local */
          <div className="w-full space-y-5">
            {cloudVaultExists === null ? (
              /* Comprobando la existencia del vault en Firestore */
              <div className="flex flex-col items-center py-10 gap-3">
                <svg className="animate-spin h-6 w-6 text-text-secondary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-xs text-text-secondary font-medium">Buscando bóveda en tu cuenta de la nube...</p>
              </div>
            ) : cloudVaultExists === false ? (
              /* Escenario A: Usuario Nuevo / Bóveda Vacía */
              <form onSubmit={handleVaultAction} className="w-full space-y-5">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-text-primary">¡Hola! Vamos a crear tu caja fuerte</h2>
                  <p className="text-xs text-text-secondary">
                    Define una Contraseña Maestra para cifrar tu base de datos localmente.
                  </p>
                </div>

                <div className="text-left space-y-3.5">
                  <PasswordField
                    label="Contraseña Maestra (mínimo 8 caracteres)"
                    value={masterPassword}
                    onChange={setMasterPassword}
                    required
                    placeholder="Introduce tu clave maestra"
                  />

                  <PasswordField
                    label="Confirmar Contraseña Maestra"
                    value={confirmMasterPassword}
                    onChange={setConfirmMasterPassword}
                    required
                    placeholder="Confirma tu clave maestra"
                  />
                </div>

                {/* Advertencia de Seguridad Importante */}
                <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl text-left flex gap-2 text-[10px] leading-relaxed text-amber-800">
                  <svg className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <span className="font-bold">Importante:</span> Si olvidas esta contraseña maestra, perderás acceso a tus datos. Nosotros no podemos recuperarla. El cifrado se realiza enteramente en tu navegador y tu clave maestra nunca viaja por internet.
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-start gap-2 text-left font-medium leading-normal animate-shake">
                    <svg className="h-4 w-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || isCloudLoading || masterPassword.length < 8 || masterPassword !== confirmMasterPassword}
                  className="w-full rounded-xl bg-text-primary py-3 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 active:scale-[0.98] duration-100 flex items-center justify-center gap-2"
                >
                  {loading || isCloudLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Inicializando bóveda...
                    </>
                  ) : (
                    'Crear Bóveda'
                  )}
                </button>
              </form>
            ) : (
              /* Escenario B: Usuario Existente */
              <form onSubmit={handleVaultAction} className="w-full space-y-5">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-text-primary">¡Bienvenido de nuevo!</h2>
                  <p className="text-xs text-text-secondary">
                    Introduce tu Contraseña Maestra para desbloquear tu bóveda.
                  </p>
                </div>

                <div className="text-left">
                  <PasswordField
                    label="Contraseña Maestra"
                    value={masterPassword}
                    onChange={setMasterPassword}
                    required
                    placeholder="Escribe tu contraseña maestra"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-start gap-2 text-left font-medium leading-normal animate-shake">
                    <svg className="h-4 w-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || isCloudLoading || !masterPassword}
                  className="w-full rounded-xl bg-text-primary py-3 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 active:scale-[0.98] duration-100 flex items-center justify-center gap-2"
                >
                  {loading || isCloudLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Desbloqueando bóveda...
                    </>
                  ) : (
                    'Desbloquear Bóveda'
                  )}
                </button>
              </form>
            )}

            {/* Cerrar sesión de la cuenta nube */}
            <div className="pt-2 text-center w-full">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading || isCloudLoading}
                className="text-[10px] font-semibold text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg hover:bg-black/[0.03] transition-all"
              >
                Cerrar sesión de la cuenta nube ({cloudUserEmail})
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

import { useState, useEffect, type FormEvent } from 'react'
import { useVault } from '../context/VaultContext'
import { PasswordField } from './ui/PasswordField'

type ScreenState = 'profile-select' | 'profile-unlock' | 'profile-create' | 'profile-restore-cloud'

/**
 * Genera una paleta de colores de fondo pastel sutiles para los perfiles locales
 * basándose en el código de caracteres del nombre del perfil.
 *
 * @param {string} name - Nombre del perfil.
 * @returns {string} Clase de Tailwind para el fondo.
 */
function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-pink-100 text-pink-700',
    'bg-indigo-100 text-indigo-700',
    'bg-teal-100 text-teal-700',
    'bg-orange-100 text-orange-700',
  ]
  const charSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return colors[charSum % colors.length]
}

/**
 * Pantalla de inicio de sesión y selección de perfiles local con estilo Apple.
 * Proporciona un flujo de onboarding intuitivo para agregar perfiles y cambiar
 * entre ellos bajo la arquitectura Zero-Knowledge.
 */
export function UnlockScreen() {
  const {
    profiles,
    isInitialized,
    createProfile,
    selectProfile,
    restoreProfileFromCloud,
    restoreProfileFromGoogleCloud,
  } = useVault()

  // Pantalla de inicio por defecto
  const [screen, setScreen] = useState<ScreenState>('profile-select')
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [selectedProfileName, setSelectedProfileName] = useState<string>('')
  
  // Inputs del formulario local
  const [profileName, setProfileName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Inputs de restauración de nube
  const [cloudEmail, setCloudEmail] = useState('')
  const [cloudPassword, setCloudPassword] = useState('')
  const [masterPassword, setMasterPassword] = useState('')
  
  // Estados de control
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Redirigir a creación si no hay perfiles creados (Onboarding inicial)
  useEffect(() => {
    if (!isInitialized && profiles.length === 0) {
      setScreen('profile-create')
    } else {
      setScreen('profile-select')
    }
  }, [isInitialized, profiles.length])

  // Scrubbing: Limpieza de contraseñas de memoria al desmontar
  useEffect(() => {
    return () => {
      setPassword('')
      setConfirmPassword('')
      setProfileName('')
      setCloudPassword('')
      setMasterPassword('')
    }
  }, [])

  const handleCreateProfile = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const name = profileName.trim()
    if (!name) {
      setError('Por favor, indica un nombre para el perfil.')
      return
    }
    if (password.length < 8) {
      setError('La contraseña maestra debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      const newId = await createProfile(name, password)
      // Desbloquear automáticamente tras crear
      const ok = await selectProfile(newId, password)
      if (!ok) {
        setError('Error al iniciar sesión tras el registro.')
      }
    } catch {
      setError('No se pudo crear el perfil.')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlockProfile = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedProfileId) return
    if (!password) {
      setError('Por favor, introduce tu contraseña.')
      return
    }

    setLoading(true)
    try {
      const ok = await selectProfile(selectedProfileId, password)
      if (!ok) {
        setError('Contraseña incorrecta.')
      }
    } catch {
      setError('Error al intentar acceder al perfil.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectProfileClick = (id: string, name: string) => {
    setSelectedProfileId(id)
    setSelectedProfileName(name)
    setError(null)
    setPassword('')
    setScreen('profile-unlock')
  }

  const handleRestoreFromCloud = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!cloudEmail.trim() || !cloudPassword || !masterPassword) {
      setError('Por favor, completa todos los campos.')
      return
    }

    setLoading(true)
    try {
      await restoreProfileFromCloud(cloudEmail.trim(), cloudPassword, masterPassword)
      // Al completarse con éxito, el contexto actualiza isUnlocked a true automáticamente
    } catch (err: any) {
      setError(err.message || 'Error al intentar descargar o restaurar la bóveda.')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setError(null)
    setPassword('')
    setConfirmPassword('')
    setProfileName('')
    setCloudEmail('')
    setCloudPassword('')
    setMasterPassword('')
    setScreen('profile-select')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-8 select-none">
      <div className="w-full max-w-md bg-white/70 backdrop-blur-xl border border-black/5 rounded-3xl p-6 sm:p-8 shadow-[0_15px_50px_rgba(0,0,0,0.06)] animate-fade-in text-center flex flex-col items-center">
        
        {/* Header con cabecera Apple */}
        <header className="mb-8 relative w-full">
          {screen !== 'profile-select' && profiles.length > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors active:scale-95 duration-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Atrás
            </button>
          )}
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Contras</h1>
          <p className="text-xs text-text-tertiary mt-1 font-medium">Bóveda Local Segura</p>
        </header>

        {/* 1. Selector de perfiles */}
        {screen === 'profile-select' && (
          <div className="w-full space-y-6">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-text-primary">¿Quién está accediendo?</h2>
              <p className="text-xs text-text-secondary">Selecciona tu perfil de contraseñas locales.</p>
            </div>

            {/* Grid de Perfiles */}
            <div className="grid grid-cols-2 gap-4 max-h-[280px] overflow-y-auto scrollbar-thin px-1 py-1">
              {profiles.map((profile) => {
                const colorClass = getAvatarColor(profile.name)
                const initial = profile.name.charAt(0).toUpperCase()

                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => handleSelectProfileClick(profile.id, profile.name)}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl border border-black/5 bg-white hover:bg-surface-hover active:scale-95 transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md"
                  >
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-base shadow-inner ${colorClass}`}>
                      {initial}
                    </div>
                    <span className="mt-2 text-xs font-semibold text-text-primary truncate w-full text-center px-1">
                      {profile.name}
                    </span>
                  </button>
                )
              })}

              {/* Botón Añadir Perfil */}
              <button
                type="button"
                onClick={() => setScreen('profile-create')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border border-dashed border-border hover:bg-surface-hover active:scale-95 transition-all duration-200"
              >
                <div className="h-12 w-12 rounded-full border border-dashed border-border flex items-center justify-center text-text-tertiary">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="mt-2 text-xs font-semibold text-text-secondary">
                  Nuevo Perfil
                </span>
              </button>

              {/* Botón Restaurar desde la Nube */}
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setScreen('profile-restore-cloud')
                }}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border border-dashed border-border hover:bg-surface-hover active:scale-95 transition-all duration-200"
              >
                <div className="h-12 w-12 rounded-full border border-dashed border-border flex items-center justify-center text-text-tertiary">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                </div>
                <span className="mt-2 text-xs font-semibold text-text-secondary">
                  Restaurar Nube
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 2. Formulario de Desbloqueo de Perfil */}
        {screen === 'profile-unlock' && (
          <form onSubmit={handleUnlockProfile} className="w-full space-y-5">
            <div className="flex flex-col items-center">
              <div className={`h-16 w-16 rounded-full flex items-center justify-center font-bold text-xl shadow-inner mb-3 ${getAvatarColor(selectedProfileName)}`}>
                {selectedProfileName.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-sm font-semibold text-text-primary">Hola, {selectedProfileName}</h2>
              <p className="text-xs text-text-secondary mt-0.5">Introduce tu contraseña maestra para desbloquear.</p>
            </div>

            <div className="text-left">
              <PasswordField
                label="Contraseña Maestra"
                value={password}
                onChange={setPassword}
                required
                placeholder="Escribe tu contraseña"
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
              disabled={loading || !password}
              className="w-full rounded-xl bg-text-primary py-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Desbloqueando...
                </>
              ) : (
                'Desbloquear'
              )}
            </button>
          </form>
        )}

        {/* 3. Creación de Perfil */}
        {screen === 'profile-create' && (
          <form onSubmit={handleCreateProfile} className="w-full space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-text-primary">Crear Perfil Local</h2>
              <p className="text-xs text-text-secondary">
                Tu contraseña cifra localmente tus datos. Nunca se guarda en internet.
              </p>
            </div>

            <div className="text-left space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Nombre del Perfil
                </label>
                <input
                  type="text"
                  placeholder="Ej. Personal, Trabajo"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-xs text-text-primary outline-none focus:border-border transition-colors font-medium"
                  required
                />
              </div>

              <PasswordField
                label="Contraseña Maestra (mínimo 8 caracteres)"
                value={password}
                onChange={setPassword}
                required
                placeholder="Introduce tu clave maestra"
              />

              <PasswordField
                label="Confirmar Contraseña"
                value={confirmPassword}
                onChange={setConfirmPassword}
                required
                placeholder="Repite la clave maestra"
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

            <div className="flex flex-col gap-2 mt-4">
              <button
                type="submit"
                disabled={loading || !profileName.trim() || password.length < 8}
                className="w-full rounded-xl bg-text-primary py-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creando perfil...
                  </>
                ) : (
                  'Crear perfil'
                )}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setScreen('profile-restore-cloud')
                }}
                className="text-[10px] font-semibold text-text-secondary hover:text-text-primary py-1"
              >
                O restaura tu bóveda desde la nube
              </button>
            </div>
          </form>
        )}

        {/* 4. Restauración desde la Nube */}
        {screen === 'profile-restore-cloud' && (
          <form onSubmit={handleRestoreFromCloud} className="w-full space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-text-primary flex items-center justify-center gap-1.5">
                <svg className="h-4 w-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
                Restaurar desde la Nube
              </h2>
              <p className="text-xs text-text-secondary">
                Descarga y descifra tu bóveda sincronizada ingresando tus credenciales de la nube y tu Contraseña Maestra.
              </p>
            </div>

            {/* Tarjeta Informativa Zero-Knowledge */}
            <div className="p-3.5 bg-surface border border-border-subtle rounded-xl text-left space-y-2 text-[10px] leading-relaxed text-text-secondary">
              <div className="flex items-center gap-1.5 font-bold text-text-primary">
                <svg className="h-4 w-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                Seguridad Zero-Knowledge E2EE
              </div>
              <p>
                🔑 <strong className="text-text-primary">Cuenta de la Nube (Firebase):</strong> Identifica tu archivo de copia cifrada en el servidor de la nube. Si olvidas esta contraseña, puedes restablecerla por email.
              </p>
              <p>
                🔒 <strong className="text-text-primary">Contraseña Maestra (Local):</strong> Se usa en tu navegador para desencriptar localmente el archivo. <strong className="text-red-600">Nunca se envía al servidor, no existe en internet y NO se puede recuperar ni restablecer de ninguna manera.</strong>
              </p>
            </div>

            <div className="text-left space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-text-secondary mb-1 uppercase tracking-wider">
                  Correo de la Cuenta Nube
                </label>
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={cloudEmail}
                  onChange={(e) => setCloudEmail(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-xs text-text-primary outline-none focus:border-border transition-colors font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-text-secondary mb-1 uppercase tracking-wider">
                  Contraseña de la Cuenta Nube
                </label>
                <input
                  type="password"
                  placeholder="Contraseña de tu cuenta de la nube"
                  value={cloudPassword}
                  onChange={(e) => setCloudPassword(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-xs text-text-primary outline-none focus:border-border transition-colors font-medium"
                  required
                />
              </div>

              <PasswordField
                label="Contraseña Maestra (para descifrar localmente)"
                value={masterPassword}
                onChange={setMasterPassword}
                required
                placeholder="Escribe la clave maestra original"
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

            <div className="flex flex-col gap-2.5 mt-4">
              <button
                type="submit"
                disabled={loading || !cloudEmail.trim() || !cloudPassword || !masterPassword}
                className="w-full rounded-xl bg-text-primary py-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Descargando y descifrando...
                  </>
                ) : (
                  'Descargar y Restaurar'
                )}
              </button>

              <div className="relative flex py-1.5 items-center">
                <div className="flex-grow border-t border-black/[0.06]"></div>
                <span className="flex-shrink mx-3 text-[9px] text-text-tertiary font-bold uppercase tracking-wider">O también</span>
                <div className="flex-grow border-t border-black/[0.06]"></div>
              </div>

              <button
                type="button"
                disabled={loading || !masterPassword}
                onClick={async () => {
                  setError(null)
                  if (!masterPassword) {
                    setError('Por favor, indica tu Contraseña Maestra antes de conectar con Google.')
                    return
                  }
                  setLoading(true)
                  try {
                    await restoreProfileFromGoogleCloud(masterPassword)
                  } catch (err: any) {
                    setError(err.message || 'Error al restaurar con Google.')
                  } finally {
                    setLoading(false)
                  }
                }}
                className="w-full rounded-xl border border-black/10 bg-white hover:bg-surface-hover py-3 text-xs font-semibold text-text-primary transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
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
                    Restaurar con Google
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setScreen(profiles.length === 0 ? 'profile-create' : 'profile-select')
                }}
                className="text-[10px] font-semibold text-text-secondary hover:text-text-primary py-1 mt-1"
              >
                {profiles.length === 0 ? 'O crea un perfil local nuevo' : 'Volver a Selección'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}

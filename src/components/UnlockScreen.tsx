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

            {error && <p className="text-xs text-red-600 font-semibold" role="alert">{error}</p>}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-xl bg-text-primary py-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 active:scale-[0.98] transition-transform duration-100"
            >
              {loading ? 'Desbloqueando...' : 'Desbloquear'}
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

            {error && <p className="text-xs text-red-600 font-semibold" role="alert">{error}</p>}

            <div className="flex flex-col gap-2 mt-4">
              <button
                type="submit"
                disabled={loading || !profileName.trim() || password.length < 8}
                className="w-full rounded-xl bg-text-primary py-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 active:scale-[0.98] transition-transform duration-100"
              >
                {loading ? 'Creando perfil...' : 'Crear perfil'}
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
                Descarga y descifra tu bóveda sincronizada ingresando tus credenciales de la nube y Contraseña Maestra.
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
                  placeholder="Contraseña de la cuenta nube"
                  value={cloudPassword}
                  onChange={(e) => setCloudPassword(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-xs text-text-primary outline-none focus:border-border transition-colors font-medium"
                  required
                />
              </div>

              <PasswordField
                label="Contraseña Maestra (para descifrar la bóveda)"
                value={masterPassword}
                onChange={setMasterPassword}
                required
                placeholder="Escribe la clave maestra original"
              />
            </div>

            {error && <p className="text-xs text-red-600 font-semibold" role="alert">{error}</p>}

            <div className="flex flex-col gap-2 mt-4">
              <button
                type="submit"
                disabled={loading || !cloudEmail.trim() || !cloudPassword || !masterPassword}
                className="w-full rounded-xl bg-text-primary py-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 active:scale-[0.98] transition-transform duration-100"
              >
                {loading ? 'Restaurando y descifrando...' : 'Descargar y Restaurar'}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setScreen(profiles.length === 0 ? 'profile-create' : 'profile-select')
                }}
                className="text-[10px] font-semibold text-text-secondary hover:text-text-primary py-1"
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

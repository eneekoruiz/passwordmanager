import { useState, useEffect } from 'react'
import { useVault } from '../context/VaultContext'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onExport: (masterPassword: string) => Promise<void>
  onImport: (backupJsonString: string, masterPassword: string) => Promise<void>
  onOpenImportText: () => void
}

export function SettingsModal({
  isOpen,
  onClose,
  onExport,
  onImport,
  onOpenImportText,
}: SettingsModalProps) {
  const {
    cloudUserEmail,
    cloudSyncStatus,
    cloudError,
    loginCloud,
    registerCloud,
    logoutCloud,
    syncActiveProfileToCloud,
  } = useVault()

  const [activeTab, setActiveTab] = useState<'local' | 'cloud'>('local')

  // Inputs locales
  const [exportPassword, setExportPassword] = useState('')
  const [importPassword, setImportPassword] = useState('')
  const [backupFile, setBackupFile] = useState<File | null>(null)
  
  const [exportError, setExportError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)

  // Inputs nube
  const [cloudEmail, setCloudEmail] = useState('')
  const [cloudPassword, setCloudPassword] = useState('')
  const [cloudMode, setCloudMode] = useState<'login' | 'register'>('login')
  const [cloudActionError, setCloudActionError] = useState<string | null>(null)
  const [loadingCloudAction, setLoadingCloudAction] = useState(false)

  const [loadingExport, setLoadingExport] = useState(false)
  const [loadingImport, setLoadingImport] = useState(false)

  // Scrubbing: Limpiar contraseñas en memoria al desmontar
  useEffect(() => {
    return () => {
      setExportPassword('')
      setImportPassword('')
      setCloudPassword('')
      setBackupFile(null)
    }
  }, [])

  if (!isOpen) return null

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault()
    setExportError(null)
    setExportSuccess(null)
    if (!exportPassword) {
      setExportError('Se requiere la contraseña maestra para cifrar la exportación.')
      return
    }

    setLoadingExport(true)
    try {
      await onExport(exportPassword)
      setExportSuccess('Copia de seguridad exportada correctamente.')
      setExportPassword('')
    } catch (err: any) {
      setExportError(err.message || 'Error al exportar la copia de seguridad.')
    } finally {
      setLoadingExport(false)
    }
  }

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    setImportError(null)
    setImportSuccess(null)
    if (!backupFile) {
      setImportError('Selecciona un archivo de copia de seguridad.')
      return
    }
    if (!importPassword) {
      setImportError('Introduce la contraseña maestra para descifrar el backup.')
      return
    }

    setLoadingImport(true)
    try {
      const reader = new FileReader()
      const fileText = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Error al leer el archivo de backup.'))
        reader.readAsText(backupFile)
      })

      await onImport(fileText, importPassword)
      setImportSuccess('Base de datos restaurada correctamente. Recargando...')
      setImportPassword('')
      setBackupFile(null)
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err: any) {
      setImportError(
        err.message || 'Contraseña incorrecta o archivo de copia de seguridad corrupto.'
      )
    } finally {
      setLoadingImport(false)
    }
  }

  const handleCloudAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setCloudActionError(null)
    if (!cloudEmail.trim() || !cloudPassword) {
      setCloudActionError('Por favor introduce tu correo y contraseña para la nube.')
      return
    }

    setLoadingCloudAction(true)
    try {
      if (cloudMode === 'login') {
        await loginCloud(cloudEmail.trim(), cloudPassword)
      } else {
        await registerCloud(cloudEmail.trim(), cloudPassword)
      }
      setCloudPassword('')
      // Sincronizar de inmediato tras iniciar sesión por primera vez
      await syncActiveProfileToCloud()
    } catch (err: any) {
      setCloudActionError(err.message || 'Error en la autenticación en la nube.')
    } finally {
      setLoadingCloudAction(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-fade-in">
      {/* Click Catcher */}
      <button
        type="button"
        className="fixed inset-0 cursor-default outline-none bg-transparent"
        onClick={onClose}
        aria-label="Cerrar modal"
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-black/5 bg-white/80 backdrop-blur-xl p-6 shadow-[0_15px_50px_rgba(0,0,0,0.12)] space-y-5 flex flex-col text-left font-sans">
        <header className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex flex-col">
            <h2 className="text-base font-bold text-text-primary">Ajustes</h2>
            <p className="text-[10px] text-text-tertiary font-medium">Bóveda Versión 1.0</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            aria-label="Cerrar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Tab Selector Estilo Apple */}
        <div className="flex bg-surface p-1 rounded-xl border border-border-subtle">
          <button
            type="button"
            onClick={() => setActiveTab('local')}
            className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'local'
                ? 'bg-white text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Copia Local
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cloud')}
            className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'cloud'
                ? 'bg-white text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            Nube (E2EE)
          </button>
        </div>

        {/* CONTENIDO DE PESTAÑA LOCAL */}
        {activeTab === 'local' && (
          <div className="space-y-5 overflow-y-auto max-h-[360px] pr-1 scrollbar-thin">
            {/* Sección de Exportación */}
            <section className="space-y-2.5">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Exportación Cifrada (Backup)</h3>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Descarga un archivo JSON cifrado localmente con AES-256-GCM que contiene todas tus credenciales.
              </p>
              <form onSubmit={handleExport} className="space-y-2.5">
                <input
                  type="password"
                  placeholder="Contraseña Maestra del perfil"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-border transition-colors font-medium"
                />
                
                {exportError && (
                  <div className="p-2 bg-red-50 border border-red-100 text-red-700 text-[10px] rounded-lg flex items-center gap-1.5 font-medium">
                    <svg className="h-3.5 w-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{exportError}</span>
                  </div>
                )}
                {exportSuccess && (
                  <div className="p-2 bg-green-50 border border-green-100 text-green-700 text-[10px] rounded-lg flex items-center gap-1.5 font-medium">
                    <svg className="h-3.5 w-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{exportSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loadingExport || !exportPassword}
                  className="w-full rounded-xl bg-text-primary py-2.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                  {loadingExport ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generando backup cifrado...
                    </>
                  ) : (
                    'Exportar JSON cifrado'
                  )}
                </button>
              </form>
            </section>

            <hr className="border-border-subtle" />

            {/* Sección de Importación */}
            <section className="space-y-2.5">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Importación / Restauración</h3>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Sube un archivo de backup JSON y proporciona la contraseña maestra original del backup para restaurar.
                <span className="text-red-600 font-semibold block mt-1">¡Sobrescribirá todos tus datos locales actuales!</span>
              </p>
              <form onSubmit={handleImport} className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-text-secondary uppercase">
                    Archivo de backup (.json)
                  </label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => setBackupFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-text-secondary file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-surface-hover file:text-text-primary hover:file:bg-surface-active file:cursor-pointer transition-colors"
                  />
                </div>
                <input
                  type="password"
                  placeholder="Contraseña Maestra del backup"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-border transition-colors font-medium"
                />
                
                {importError && (
                  <div className="p-2 bg-red-50 border border-red-100 text-red-700 text-[10px] rounded-lg flex items-center gap-1.5 font-medium">
                    <svg className="h-3.5 w-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{importError}</span>
                  </div>
                )}
                {importSuccess && (
                  <div className="p-2 bg-green-50 border border-green-100 text-green-700 text-[10px] rounded-lg flex items-center gap-1.5 font-medium">
                    <svg className="h-3.5 w-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{importSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loadingImport || !backupFile || !importPassword}
                  className="w-full rounded-xl border border-border bg-surface-elevated hover:bg-surface-hover py-2.5 text-xs font-semibold text-text-primary transition-colors disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                  {loadingImport ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-text-primary" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Descifrando e importando...
                    </>
                  ) : (
                    'Importar y Restaurar'
                  )}
                </button>
              </form>
            </section>

            <hr className="border-border-subtle" />

            {/* Sección de Importación Masiva */}
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Importación Masiva</h3>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Importa cuentas pegando filas copiadas de una tabla de Google Docs (formato TSV).
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenImportText()
                }}
                className="w-full rounded-xl border border-border bg-surface-elevated hover:bg-surface-hover py-2.5 text-xs font-semibold text-text-primary transition-colors active:scale-[0.98] transition-transform"
              >
                Importar desde Google Docs / TSV...
              </button>
            </section>
          </div>
        )}

        {/* CONTENIDO DE PESTAÑA NUBE */}
        {activeTab === 'cloud' && (
          <div className="space-y-4 animate-fade-in">
            {cloudUserEmail === null ? (
              // 1. Mostrar Login/Registro
              <form onSubmit={handleCloudAuth} className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    {cloudMode === 'login' ? 'Iniciar Sesión en la Nube' : 'Crear Cuenta en la Nube'}
                  </h3>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    Identifica tu cuenta para habilitar el backup E2EE en la nube. Tu Contraseña Maestra de descifrado local **nunca** viaja a internet.
                  </p>
                </div>

                {/* Tarjeta Informativa Zero-Knowledge */}
                <div className="p-3 bg-surface border border-border-subtle rounded-xl text-left space-y-1.5 text-[10px] leading-relaxed text-text-secondary">
                  <div className="flex items-center gap-1 font-semibold text-text-primary">
                    <svg className="h-3.5 w-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    Seguridad Zero-Knowledge E2EE
                  </div>
                  <p>
                    Tu Contraseña Maestra cifra localmente los datos en tu navegador usando AES-256-GCM. <strong>Nunca se envía a internet y no se comparte con Firebase.</strong>
                  </p>
                </div>

                <div className="space-y-2.5 text-left">
                  <div>
                    <label className="block text-[9px] font-bold text-text-secondary uppercase mb-1">
                      Correo Electrónico
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
                    <label className="block text-[9px] font-bold text-text-secondary uppercase mb-1">
                      Contraseña de la Cuenta Nube
                    </label>
                    <input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={cloudPassword}
                      onChange={(e) => setCloudPassword(e.target.value)}
                      className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-xs text-text-primary outline-none focus:border-border transition-colors font-medium"
                      required
                    />
                  </div>
                </div>

                {(cloudActionError || cloudError) && (
                  <div className="p-2.5 bg-red-50 border border-red-100 text-red-700 text-[10px] rounded-xl flex items-start gap-1.5 font-medium leading-normal">
                    <svg className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{cloudActionError || cloudError}</span>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={loadingCloudAction || !cloudEmail.trim() || cloudPassword.length < 6}
                    className="w-full rounded-xl bg-text-primary py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                  >
                    {loadingCloudAction ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {cloudMode === 'login' ? 'Conectando...' : 'Registrando...'}
                      </>
                    ) : (
                      cloudMode === 'login' ? 'Conectar Cuenta' : 'Registrar y Conectar'
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setCloudMode(cloudMode === 'login' ? 'register' : 'login')
                      setCloudActionError(null)
                    }}
                    className="text-center text-[10px] font-semibold text-text-secondary hover:text-text-primary py-1"
                  >
                    {cloudMode === 'login'
                      ? '¿No tienes cuenta? Regístrate en la nube'
                      : '¿Ya tienes cuenta? Inicia sesión'}
                  </button>
                </div>
              </form>
            ) : (
              // 2. Mostrar estado sincronizado / opciones
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-surface border border-border-subtle flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-text-secondary uppercase">Cuenta Conectada</span>
                    <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                  <p className="text-xs font-semibold text-text-primary truncate">{cloudUserEmail}</p>
                  
                  <div className="flex items-center justify-between border-t border-border-subtle pt-2.5 mt-1">
                    <span className="text-[10px] font-bold text-text-secondary uppercase">Estado de Backup</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      cloudSyncStatus === 'synced' ? 'text-green-600' :
                      cloudSyncStatus === 'syncing' ? 'text-blue-600 animate-pulse' :
                      cloudSyncStatus === 'error' ? 'text-red-600' : 'text-text-secondary'
                    }`}>
                      {cloudSyncStatus === 'synced' ? 'Sincronizado' :
                       cloudSyncStatus === 'syncing' ? 'Guardando...' :
                       cloudSyncStatus === 'error' ? 'Error de red' : 'Listo'}
                    </span>
                  </div>
                </div>

                {cloudError && (
                  <div className="p-3 rounded-lg bg-red-50 text-[10px] text-red-700 border border-red-100 font-medium leading-normal">
                    {cloudError}
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await syncActiveProfileToCloud()
                      } catch {
                        // handled by sync state
                      }
                    }}
                    disabled={cloudSyncStatus === 'syncing'}
                    className="w-full rounded-xl bg-text-primary py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5"
                  >
                    {cloudSyncStatus === 'syncing' ? 'Guardando...' : 'Sincronizar Bóveda Ahora'}
                  </button>
                  <button
                    type="button"
                    onClick={logoutCloud}
                    className="w-full rounded-xl border border-border bg-surface-elevated hover:bg-surface-hover py-2.5 text-xs font-semibold text-red-600 transition-colors active:scale-[0.98] transition-transform"
                  >
                    Desconectar Cuenta de la Nube
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

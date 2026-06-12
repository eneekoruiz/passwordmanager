import { useState, useEffect } from 'react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onExport: (masterPassword: string) => Promise<void>
  onImport: (backupJsonString: string, masterPassword: string) => Promise<void>
  onOpenImportText: () => void
}

/**
 * Modal simplificado para la gestión de copia local (JSON cifrado) y la importación de TSV (Google Docs).
 * Cumple con la directiva de eliminar la complejidad de la configuración, centrando el control en la barra lateral.
 */
export function SettingsModal({
  isOpen,
  onClose,
  onExport,
  onImport,
  onOpenImportText,
}: SettingsModalProps) {
  const [exportPassword, setExportPassword] = useState('')
  const [importPassword, setImportPassword] = useState('')
  const [backupFile, setBackupFile] = useState<File | null>(null)
  
  const [exportError, setExportError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)

  const [loadingExport, setLoadingExport] = useState(false)
  const [loadingImport, setLoadingImport] = useState(false)

  // Memory scrubbing: Limpiar contraseñas al desmontar
  useEffect(() => {
    return () => {
      setExportPassword('')
      setImportPassword('')
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-fade-in">
      <button
        type="button"
        className="fixed inset-0 cursor-default outline-none bg-transparent"
        onClick={onClose}
        aria-label="Cerrar modal"
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-black/5 bg-white/80 backdrop-blur-xl p-6 shadow-[0_15px_50px_rgba(0,0,0,0.12)] space-y-5 flex flex-col text-left font-sans">
        <header className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex flex-col">
            <h2 className="text-base font-bold text-text-primary">Datos y Copias de Seguridad</h2>
            <p className="text-[10px] text-text-tertiary font-medium">Bóveda Cifrada Localmente</p>
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

        <div className="space-y-5 overflow-y-auto max-h-[420px] pr-1 scrollbar-thin">
          {/* Sección de Importación Masiva */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Importación Masiva TSV</h3>
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

          <hr className="border-border-subtle" />

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
        </div>
      </div>
    </div>
  )
}

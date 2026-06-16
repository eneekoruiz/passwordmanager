import { useState, useEffect, type FormEvent } from 'react'
import { getFriendlyErrorMessage } from '../utils/errors'
import type { Identity, LocalVaultItem } from '../types'
import { buildPlaintextCsv, buildPlaintextJson, downloadPlaintextFile } from '../utils/exportVault'

type PlaintextExportFormat = 'csv' | 'json'

const checkboxClassName =
  'h-5 w-5 shrink-0 cursor-pointer rounded-md border border-black/15 bg-white accent-slate-950 shadow-sm transition-transform duration-150 checked:scale-105 focus:outline-none focus:ring-4 focus:ring-black/[0.06]'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onExport: (masterPassword: string) => Promise<void>
  identities: Identity[]
  localItems: LocalVaultItem[]
  onVerifyMasterPassword: (masterPassword: string) => Promise<boolean>
  onChangeMasterPassword: (currentPassword: string, nextPassword: string, recoveryPhrase: string) => Promise<void>
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
  identities,
  localItems,
  onVerifyMasterPassword,
  onChangeMasterPassword,
  onImport,
  onOpenImportText,
}: SettingsModalProps) {
  const [exportPassword, setExportPassword] = useState('')
  const [importPassword, setImportPassword] = useState('')
  const [backupFile, setBackupFile] = useState<File | null>(null)
  const [plaintextFormat, setPlaintextFormat] = useState<PlaintextExportFormat>('csv')
  const [selectedIdentityIds, setSelectedIdentityIds] = useState<string[]>([])
  const [securityModalOpen, setSecurityModalOpen] = useState(false)
  const [securityPassword, setSecurityPassword] = useState('')
  const [currentMasterPassword, setCurrentMasterPassword] = useState('')
  const [nextMasterPassword, setNextMasterPassword] = useState('')
  const [recoveryPhrase, setRecoveryPhrase] = useState('')
  
  const [exportError, setExportError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [plaintextExportError, setPlaintextExportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [plaintextExportSuccess, setPlaintextExportSuccess] = useState<string | null>(null)
  const [credentialsMessage, setCredentialsMessage] = useState<string | null>(null)
  const [credentialsError, setCredentialsError] = useState<string | null>(null)

  const [loadingExport, setLoadingExport] = useState(false)
  const [loadingImport, setLoadingImport] = useState(false)
  const [loadingPlaintextExport, setLoadingPlaintextExport] = useState(false)
  const [loadingPasswordChange, setLoadingPasswordChange] = useState(false)

  // Memory scrubbing: Limpiar contraseñas al desmontar
  useEffect(() => {
    return () => {
      setExportPassword('')
      setImportPassword('')
      setSecurityPassword('')
      setCurrentMasterPassword('')
      setNextMasterPassword('')
      setRecoveryPhrase('')
      setBackupFile(null)
    }
  }, [])

  if (!isOpen) return null

  const selectedIdentities =
    selectedIdentityIds.length === 0
      ? identities
      : identities.filter((identity) => selectedIdentityIds.includes(identity.id))

  const toggleIdentitySelection = (id: string) => {
    setSelectedIdentityIds((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    )
  }

  const handleExport = async (e: FormEvent) => {
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
    } catch (error) {
      setExportError(getFriendlyErrorMessage(error, 'Error al exportar la copia de seguridad.'))
    } finally {
      setLoadingExport(false)
    }
  }

  const handlePlaintextExport = async (event: FormEvent) => {
    event.preventDefault()
    setPlaintextExportError(null)
    setPlaintextExportSuccess(null)

    if (selectedIdentities.length === 0) {
      setPlaintextExportError('Selecciona al menos una identidad para exportar.')
      return
    }

    setSecurityPassword('')
    setSecurityModalOpen(true)
  }

  const executePlaintextExport = async (event: FormEvent) => {
    event.preventDefault()
    setPlaintextExportError(null)
    setPlaintextExportSuccess(null)

    if (!securityPassword) {
      setPlaintextExportError('Introduce tu Contraseña Maestra para autorizar la exportación.')
      return
    }

    let plaintext = ''
    setLoadingPlaintextExport(true)
    try {
      const verified = await onVerifyMasterPassword(securityPassword)
      if (!verified) {
        setPlaintextExportError('Contraseña Maestra incorrecta.')
        return
      }

      const date = new Date().toISOString().slice(0, 10)
      if (plaintextFormat === 'csv') {
        plaintext = buildPlaintextCsv(selectedIdentities)
        downloadPlaintextFile(plaintext, `contras_export_${date}.csv`, 'text/csv;charset=utf-8')
      } else {
        plaintext = buildPlaintextJson(selectedIdentities, selectedIdentityIds.length === 0 ? localItems : [])
        downloadPlaintextFile(plaintext, `contras_export_${date}.json`, 'application/json;charset=utf-8')
      }
      setPlaintextExportSuccess('Exportación en texto plano generada. Elimina el archivo cuando termines.')
      setSecurityModalOpen(false)
      setSecurityPassword('')
    } catch (error) {
      setPlaintextExportError(getFriendlyErrorMessage(error, 'No se pudo generar la exportación.'))
    } finally {
      plaintext = ''
      setLoadingPlaintextExport(false)
    }
  }

  const handleImport = async (e: FormEvent) => {
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
    } catch (error) {
      setImportError(
        getFriendlyErrorMessage(
          error,
          'Contraseña incorrecta o archivo de copia de seguridad corrupto.',
        ),
      )
    } finally {
      setLoadingImport(false)
    }
  }

  const handleChangeMasterPassword = async (event: FormEvent) => {
    event.preventDefault()
    setCredentialsError(null)
    setCredentialsMessage(null)
    if (nextMasterPassword.length < 8) {
      setCredentialsError('La nueva Contraseña Maestra debe tener al menos 8 caracteres.')
      return
    }
    if (!recoveryPhrase.trim()) {
      setCredentialsError('Introduce tu frase de recuperación para regenerar el kit de emergencia.')
      return
    }

    setLoadingPasswordChange(true)
    try {
      await onChangeMasterPassword(currentMasterPassword, nextMasterPassword, recoveryPhrase)
      setCredentialsMessage('Contraseña Maestra actualizada y bóveda re-cifrada correctamente.')
      setCurrentMasterPassword('')
      setNextMasterPassword('')
      setRecoveryPhrase('')
    } catch (error) {
      setCredentialsError(getFriendlyErrorMessage(error, 'No se pudo cambiar la Contraseña Maestra.'))
    } finally {
      setLoadingPasswordChange(false)
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

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-black/5 bg-white/80 backdrop-blur-xl p-6 shadow-[0_15px_50px_rgba(0,0,0,0.12)] space-y-5 flex flex-col text-left font-sans">
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

          <section className="space-y-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">Credenciales y recuperación</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                Cambia la Contraseña Maestra local re-cifrando toda la bóveda. La contraseña de Google Cloud se gestiona en tu cuenta de Google.
              </p>
            </div>
            <form onSubmit={handleChangeMasterPassword} className="space-y-2.5 rounded-2xl border border-black/[0.06] bg-white/70 p-3">
              <input
                type="password"
                value={currentMasterPassword}
                onChange={(event) => setCurrentMasterPassword(event.target.value)}
                placeholder="Contraseña Maestra actual"
                className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-xs font-medium text-text-primary outline-none transition-colors focus:border-border"
                autoComplete="current-password"
              />
              <input
                type="password"
                value={nextMasterPassword}
                onChange={(event) => setNextMasterPassword(event.target.value)}
                placeholder="Nueva Contraseña Maestra"
                className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-xs font-medium text-text-primary outline-none transition-colors focus:border-border"
                autoComplete="new-password"
              />
              <textarea
                value={recoveryPhrase}
                onChange={(event) => setRecoveryPhrase(event.target.value)}
                placeholder="Frase de recuperación de 12 palabras"
                className="min-h-20 w-full resize-y rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-xs font-medium text-text-primary outline-none transition-colors focus:border-border"
              />
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] font-medium leading-relaxed text-blue-900">
                Salvavidas correcto: guarda la frase de recuperación creada en onboarding. Si olvidas la Contraseña Maestra y no tienes esa frase, la app no puede descifrar tus datos sin romper el modelo zero-knowledge.
              </div>
              {credentialsError && <div className="rounded-lg border border-red-100 bg-red-50 p-2 text-[10px] font-medium text-red-700">{credentialsError}</div>}
              {credentialsMessage && <div className="rounded-lg border border-green-100 bg-green-50 p-2 text-[10px] font-medium text-green-700">{credentialsMessage}</div>}
              <button
                type="submit"
                disabled={loadingPasswordChange || !currentMasterPassword || !nextMasterPassword}
                className="flex min-h-11 w-full items-center justify-center rounded-xl bg-text-primary py-2.5 text-xs font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-40"
              >
                {loadingPasswordChange ? 'Re-cifrando bóveda...' : 'Cambiar Contraseña Maestra'}
              </button>
              <a
                href="https://myaccount.google.com/security"
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-black/5 bg-surface-elevated py-2.5 text-center text-xs font-bold text-text-primary transition-colors hover:bg-surface-hover"
              >
                Cambiar contraseña de la Cuenta Cloud
              </a>
            </form>
          </section>

          <hr className="border-border-subtle" />

          <section className="space-y-3">
            <div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Exportación Portable sin Cifrar</h3>
              <p className="mt-1 text-[11px] text-text-secondary leading-relaxed">
                Genera CSV compatible con gestores de contraseñas o JSON completo con todos los metadatos.
              </p>
            </div>
            <form onSubmit={handlePlaintextExport} className="space-y-3">
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-border-subtle bg-surface p-1">
                {(['csv', 'json'] as PlaintextExportFormat[]).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setPlaintextFormat(format)}
                    className={`rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                      plaintextFormat === format
                        ? 'bg-text-primary text-white shadow-sm'
                        : 'text-text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-border-subtle bg-white/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
                    Alcance
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedIdentityIds([])}
                    className="rounded-lg px-2 py-1 text-[10px] font-semibold text-text-secondary transition-colors hover:bg-surface-hover"
                  >
                    Toda la bóveda
                  </button>
                </div>
                <div className="max-h-32 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
                  {identities.map((identity) => {
                    const checked = selectedIdentityIds.length === 0 || selectedIdentityIds.includes(identity.id)
                    return (
                      <label
                        key={identity.id}
                        className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover"
                      >
                        <span className="truncate">{identity.email}</span>
                        <input
                          type="checkbox"
                          className={checkboxClassName}
                          checked={checked}
                          onChange={() => toggleIdentitySelection(identity.id)}
                        />
                      </label>
                    )
                  })}
                </div>
                <p className="mt-2 text-[10px] text-text-tertiary">
                  {selectedIdentityIds.length === 0
                    ? 'Se exportará toda la bóveda, incluidos secretos locales en JSON.'
                    : `Se exportarán ${selectedIdentities.length} identidad(es).`}
                </p>
              </div>

              {plaintextExportError && (
                <div className="rounded-lg border border-red-100 bg-red-50 p-2 text-[10px] font-medium text-red-700">
                  {plaintextExportError}
                </div>
              )}
              {plaintextExportSuccess && (
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-[10px] font-medium text-amber-800">
                  {plaintextExportSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={loadingPlaintextExport || identities.length === 0}
                className="flex min-h-11 w-full items-center justify-center rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-xs font-bold text-amber-900 transition-all hover:bg-amber-100 disabled:opacity-40 active:scale-[0.98]"
              >
                Exportar con re-autenticación
              </button>
            </form>
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
      {securityModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-amber-950/25 p-4 backdrop-blur-md animate-vault-morph">
          <div className="w-full max-w-md rounded-3xl border border-amber-200 bg-white/95 p-6 text-left shadow-[0_30px_90px_rgba(146,64,14,0.22)]">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M4.93 19.07h14.14c1.54 0 2.5-1.67 1.73-3L13.73 3.93c-.77-1.33-2.69-1.33-3.46 0L3.2 16.07c-.77 1.33.19 3 1.73 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-text-primary">Re-autenticación requerida</h2>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-medium leading-relaxed text-amber-900">
              Atención: El archivo que vas a descargar contiene todas tus contraseñas y claves en texto plano y sin encriptar. Cualquiera que tenga acceso a este archivo podrá leer tus credenciales. Guárdalo en un entorno seguro (como un USB cifrado) y elimínalo de tu carpeta de Descargas lo antes posible.
            </div>
            <form onSubmit={executePlaintextExport} className="mt-5 space-y-4">
              <input
                type="password"
                value={securityPassword}
                onChange={(event) => setSecurityPassword(event.target.value)}
                placeholder="Contraseña Maestra"
                className="w-full rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm font-medium text-text-primary outline-none transition-colors focus:border-border"
                autoComplete="current-password"
              />
              {plaintextExportError && (
                <div className="rounded-lg border border-red-100 bg-red-50 p-2 text-[10px] font-medium text-red-700">
                  {plaintextExportError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSecurityModalOpen(false)
                    setSecurityPassword('')
                    setPlaintextExportError(null)
                  }}
                  disabled={loadingPlaintextExport}
                  className="min-h-11 rounded-xl bg-surface-hover px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-active disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingPlaintextExport || !securityPassword}
                  className="min-h-11 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white shadow-sm shadow-amber-700/20 transition-all hover:bg-amber-700 disabled:opacity-40 active:scale-[0.98]"
                >
                  {loadingPlaintextExport ? 'Verificando...' : 'Descargar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

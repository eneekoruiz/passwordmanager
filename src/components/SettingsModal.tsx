import { useState, useEffect, useMemo, type FormEvent } from 'react'
import { getFriendlyErrorMessage } from '../utils/errors'
import type { Identity, LocalVaultItem } from '../types'
import { buildPlaintextCsv, buildPlaintextJson, downloadPlaintextFile } from '../utils/exportVault'

type PlaintextExportFormat = 'csv' | 'json'

const checkboxClassName =
  'h-5 w-5 shrink-0 cursor-pointer rounded-md border border-black/15 bg-white accent-slate-950 shadow-sm transition-transform duration-150 checked:scale-105 focus:outline-none focus:ring-4 focus:ring-black/[0.06]'

function passwordForPlatform(platform: Identity['platforms'][number] | undefined): string {
  return platform?.accessMethods?.find((method) => method?.type === 'PASSWORD')?.password ?? ''
}

function passwordStrengthIssue(password: string): boolean {
  if (password.length < 8) return true
  return !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onExport: (masterPassword: string) => Promise<void>
  identities: Identity[]
  localItems: LocalVaultItem[]
  onVerifyMasterPassword: (masterPassword: string) => Promise<boolean>
  onChangeMasterPassword: (currentPassword: string, nextPassword: string, recoveryPhrase: string) => Promise<void>
  travelModeEnabled: boolean
  onEnableTravelMode: () => void
  onDisableTravelMode: (masterPassword: string) => Promise<void>
  onImport: (backupJsonString: string, masterPassword: string) => Promise<void>
  onOpenImportText: () => void
  biometricAvailable?: boolean
  biometricRegistered?: boolean
  onRegisterBiometric?: (masterPassword: string) => Promise<void>
  onDisableBiometric?: () => Promise<void>
  hardwareKeyAvailable?: boolean
  hardwareKeyRegistered?: boolean
  onRegisterHardwareKey?: (masterPassword: string) => Promise<void>
  onDisableHardwareKey?: () => Promise<void>
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
  travelModeEnabled,
  onEnableTravelMode,
  onDisableTravelMode,
  onImport,
  onOpenImportText,
  biometricAvailable = false,
  biometricRegistered = false,
  onRegisterBiometric,
  onDisableBiometric,
  hardwareKeyAvailable = false,
  hardwareKeyRegistered = false,
  onRegisterHardwareKey,
  onDisableHardwareKey,
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
  const [travelPassword, setTravelPassword] = useState('')
  
  const [exportError, setExportError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [plaintextExportError, setPlaintextExportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [plaintextExportSuccess, setPlaintextExportSuccess] = useState<string | null>(null)
  const [credentialsMessage, setCredentialsMessage] = useState<string | null>(null)
  const [credentialsError, setCredentialsError] = useState<string | null>(null)
  const [travelError, setTravelError] = useState<string | null>(null)

  const [loadingExport, setLoadingExport] = useState(false)
  const [loadingImport, setLoadingImport] = useState(false)
  const [loadingPlaintextExport, setLoadingPlaintextExport] = useState(false)
  const [loadingPasswordChange, setLoadingPasswordChange] = useState(false)
  const [loadingTravelMode, setLoadingTravelMode] = useState(false)
  const [loadingBiometric, setLoadingBiometric] = useState(false)
  const [biometricPassword, setBiometricPassword] = useState('')
  const [biometricMessage, setBiometricMessage] = useState<string | null>(null)
  const [biometricError, setBiometricError] = useState<string | null>(null)
  const [loadingHardwareKey, setLoadingHardwareKey] = useState(false)
  const [hardwareKeyPassword, setHardwareKeyPassword] = useState('')
  const [hardwareKeyMessage, setHardwareKeyMessage] = useState<string | null>(null)
  const [hardwareKeyError, setHardwareKeyError] = useState<string | null>(null)
  const [view, setView] = useState<'main' | 'health' | 'travel' | 'credentials' | 'exportPlaintext' | 'exportBackup' | 'importBackup' | 'biometric' | 'hardwareKey'>('health')

  // Memory scrubbing: Limpiar contraseñas al desmontar
  useEffect(() => {
    return () => {
      setExportPassword('')
      setImportPassword('')
      setSecurityPassword('')
      setCurrentMasterPassword('')
      setNextMasterPassword('')
      setRecoveryPhrase('')
      setTravelPassword('')
      setBiometricPassword('')
      setHardwareKeyPassword('')
      setBackupFile(null)
    }
  }, [])

  const selectedIdentities =
    selectedIdentityIds.length === 0
      ? identities
      : identities.filter((identity) => selectedIdentityIds.includes(identity.id))

  const {
    reusedPasswords,
    weakPasswords,
    oldPasswords,
    healthScore,
    totalPasswordsCount,
    securePasswordsCount,
  } = useMemo(() => {
    const entries = (identities || []).flatMap((identity) =>
      (identity?.platforms || []).map((platform) => ({
        identityEmail: identity?.email,
        platform,
        password: passwordForPlatform(platform),
      })),
    ).filter((entry) => entry?.password)

    const reused = entries.filter((entry, _, all) =>
      all.some((other) => other !== entry && other?.password === entry?.password),
    )
    const weak = entries.filter((entry) => passwordStrengthIssue(entry?.password || ''))
    const old = entries.filter((entry) => {
      if (!entry?.platform?.updatedAt) return false
      const time = Date.parse(entry.platform.updatedAt)
      return Number.isFinite(time) && Date.now() - time > 365 * 24 * 60 * 60 * 1000
    })

    // El score se calcula abajo basado en el % de seguras

    const insecureIds = new Set([
      ...reused.map((r) => r?.platform?.id).filter(Boolean),
      ...weak.map((w) => w?.platform?.id).filter(Boolean),
      ...old.map((o) => o?.platform?.id).filter(Boolean),
    ])

    const total = entries.length
    const secureCount = entries.filter((entry) => entry?.platform?.id && !insecureIds.has(entry.platform.id)).length

    return {
      healthEntries: entries,
      reusedPasswords: reused,
      weakPasswords: weak,
      oldPasswords: old,
      healthScore: entries.length === 0 ? 100 : Math.round((secureCount / entries.length) * 100),
      totalPasswordsCount: total,
      securePasswordsCount: secureCount,
    }
  }, [identities])

  if (!isOpen) return null

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

  const handleDisableTravelMode = async (event: FormEvent) => {
    event.preventDefault()
    setTravelError(null)
    setLoadingTravelMode(true)
    try {
      await onDisableTravelMode(travelPassword)
      setTravelPassword('')
      setBiometricPassword('')
    } catch (error) {
      setTravelError(getFriendlyErrorMessage(error, 'No se pudo desactivar el Modo Viaje.'))
    } finally {
      setLoadingTravelMode(false)
    }
  }

  const MenuItem = ({ title, subtitle, onClick }: { title: string, subtitle: string, onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl border border-black/5 bg-white/70 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow"
    >
      <div>
        <h3 className="text-xs font-bold text-text-primary">{title}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">{subtitle}</p>
      </div>
      <svg className="h-5 w-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm animate-fade-in">
      <button
        type="button"
        className="fixed inset-0 cursor-default bg-transparent outline-none"
        onClick={onClose}
        aria-label="Cerrar modal"
      />

      <div className="relative z-10 flex w-full max-w-lg lg:max-w-2xl mx-auto flex-col space-y-5 rounded-2xl border border-black/5 bg-white/80 p-6 font-sans text-left shadow-[0_15px_50px_rgba(0,0,0,0.12)] backdrop-blur-xl">
        <header className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-3">
            {view !== 'health' && (
              <button
                type="button"
                onClick={() => setView('health')}
                className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                aria-label="Volver"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="flex flex-col">
              <h2 className="text-base font-bold text-text-primary">
                {view === 'health' && 'Ajustes de Bóveda'}
                {view === 'travel' && 'Modo Viaje'}
                {view === 'credentials' && 'Credenciales'}
                {view === 'exportPlaintext' && 'Exportar Texto Plano'}
                {view === 'exportBackup' && 'Crear Copia de Seguridad'}
                {view === 'importBackup' && 'Restaurar Copia'}
                {view === 'biometric' && 'Biometría'}
                {view === 'hardwareKey' && 'Llave Física'}
              </h2>
              {view === 'health' && <p className="text-[10px] font-medium text-text-tertiary">Bóveda Cifrada Localmente</p>}
            </div>
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

        <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1 scrollbar-thin">
          {view === 'health' && (
            <div className="space-y-4 animate-vault-morph">
              {/* Puntuación de Seguridad */}
              <div className="flex items-center justify-between rounded-3xl border border-black/[0.06] bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">Puntuación de Seguridad</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">Basado en auditoría Zero-Knowledge</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-text-primary text-lg font-black text-white shadow-[0_8px_20px_rgba(15,23,42,0.16)]">
                  {healthScore}
                </div>
              </div>

              {/* Psicología Positiva */}
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 flex items-start gap-3 shadow-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white mt-0.5">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">Tu Bóveda está protegida</h4>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-800">
                    Tienes <span className="font-bold">{totalPasswordsCount}</span> contraseñas guardadas. <span className="font-bold">{securePasswordsCount} contraseñas seguras y a salvo</span>.
                  </p>
                </div>
              </div>

              {/* Grid de Auditoría */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-red-100 bg-red-50 p-3">
                  <p className="text-lg font-black text-red-700">{reusedPasswords.length}</p>
                  <p className="text-[10px] font-bold text-red-700">Reutilizadas</p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
                  <p className="text-lg font-black text-amber-800">{weakPasswords.length}</p>
                  <p className="text-[10px] font-bold text-amber-800">Débiles</p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
                  <p className="text-lg font-black text-blue-800">{oldPasswords.length}</p>
                  <p className="text-[10px] font-bold text-blue-800">Antiguas</p>
                </div>
              </div>

              {/* Listado de problemas */}
              {reusedPasswords.length > 0 || weakPasswords.length > 0 || oldPasswords.length > 0 ? (
                <div className="overflow-y-auto rounded-2xl border border-black/[0.04] bg-white/80 p-2 max-h-32 scrollbar-thin">
                  {[...new Set([...reusedPasswords, ...weakPasswords, ...oldPasswords].map((entry) => `${entry?.platform?.name || 'Desconocida'} · ${entry?.identityEmail || 'Sin email'}`))]
                    .map((label) => (
                      <div key={label} className="rounded-xl px-2 py-1.5 text-[11px] font-semibold text-text-secondary">{label}</div>
                    ))}
                </div>
              ) : null}

              {/* Ajustes de Configuración */}
              <div className="pt-2 space-y-2">
                <h3 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Ajustes de Bóveda</h3>
                
                <MenuItem
                  title="Modo Viaje"
                  subtitle="Oculta bóvedas sensibles al cruzar fronteras."
                  onClick={() => setView('travel')}
                />
                <MenuItem
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
                {hardwareKeyAvailable && (
                  <MenuItem
                    title={hardwareKeyRegistered ? '🔒 Llave Física Activada' : '🔑 Activar Llave Física'}
                    subtitle={hardwareKeyRegistered ? 'Llave de seguridad FIDO2 (YubiKey) activa.' : 'Registra una llave de seguridad física USB/NFC para desbloquear.'}
                    onClick={() => { setHardwareKeyMessage(null); setHardwareKeyError(null); setHardwareKeyPassword(''); setView('hardwareKey') }}
                  />
                )}
                
                <div className="pt-2">
                  <h3 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Importar y Exportar</h3>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onOpenImportText()
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-black/5 bg-white/70 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow"
                    >
                      <div>
                        <h3 className="text-xs font-bold text-text-primary">Importación Masiva (TSV)</h3>
                        <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">Pega filas de Google Docs u Hojas de cálculo.</p>
                      </div>
                      <svg className="h-5 w-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <MenuItem
                      title="Restaurar Copia Cifrada"
                      subtitle="Cargar backup .json"
                      onClick={() => setView('importBackup')}
                    />
                    <MenuItem
                      title="Crear Copia Cifrada"
                      subtitle="Descargar backup .json"
                      onClick={() => setView('exportBackup')}
                    />
                    <MenuItem
                      title="Exportar Texto Plano"
                      subtitle="CSV o JSON sin cifrar."
                      onClick={() => setView('exportPlaintext')}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'biometric' && (
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
                        setView('health')
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
                      setView('health')
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



          {view === 'travel' && (
            <div className="space-y-3 animate-vault-morph">
              <p className="text-[11px] leading-relaxed text-text-secondary">
                Oculta visualmente plataformas marcadas como sensibles hasta verificar la Contraseña Maestra. Útil en pasos fronterizos.
              </p>
              <div className={`rounded-2xl border p-4 ${travelModeEnabled ? 'border-blue-100 bg-blue-50' : 'border-black/[0.06] bg-white/70'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-text-primary">{travelModeEnabled ? 'Modo Viaje activo' : 'Bóveda completa visible'}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                      Marca cuentas como sensibles desde el formulario de cuenta.
                    </p>
                  </div>
                  {!travelModeEnabled && (
                    <button
                      type="button"
                      onClick={onEnableTravelMode}
                      className="min-h-10 rounded-xl bg-text-primary px-4 text-xs font-bold text-white transition-all hover:-translate-y-0.5"
                    >
                      Activar
                    </button>
                  )}
                </div>
                {travelModeEnabled && (
                  <form onSubmit={handleDisableTravelMode} className="mt-4 space-y-2">
                    <input
                      type="password"
                      value={travelPassword}
                      onChange={(event) => setTravelPassword(event.target.value)}
                      placeholder="Contraseña Maestra para desactivar"
                      className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2.5 text-xs font-medium text-text-primary outline-none transition-colors focus:border-border"
                      autoComplete="current-password"
                    />
                    {travelError && <div className="rounded-lg border border-red-100 bg-red-50 p-2 text-[10px] font-medium text-red-700">{travelError}</div>}
                    <button
                      type="submit"
                      disabled={loadingTravelMode || !travelPassword}
                      className="min-h-10 w-full rounded-xl bg-text-primary px-4 text-xs font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-40"
                    >
                      {loadingTravelMode ? 'Verificando...' : 'Desactivar Modo Viaje'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {view === 'credentials' && (
            <div className="space-y-3 animate-vault-morph">
              <p className="text-[11px] leading-relaxed text-text-secondary">
                Cambia la Contraseña Maestra local re-cifrando toda la bóveda. La contraseña de Google Cloud se gestiona en tu cuenta de Google.
              </p>
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
            </div>
          )}

          {view === 'exportPlaintext' && (
            <div className="space-y-3 animate-vault-morph">
              <p className="text-[11px] leading-relaxed text-text-secondary">
                Genera CSV compatible con gestores de contraseñas o JSON completo con todos los metadatos.
              </p>
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
                    {(identities || []).filter(Boolean).map((identity) => {
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
            </div>
          )}

          {view === 'exportBackup' && (
            <div className="space-y-3 animate-vault-morph">
              <p className="text-[11px] leading-relaxed text-text-secondary">
                Descarga un archivo JSON cifrado localmente con AES-256-GCM que contiene todas tus credenciales.
              </p>
              <form onSubmit={handleExport} className="space-y-2.5">
                <input
                  type="password"
                  placeholder="Contraseña Maestra del perfil"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-xs font-medium text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus:border-border"
                />
                
                {exportError && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 p-2 text-[10px] font-medium text-red-700">
                    <svg className="h-3.5 w-3.5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{exportError}</span>
                  </div>
                )}
                {exportSuccess && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-green-100 bg-green-50 p-2 text-[10px] font-medium text-green-700">
                    <svg className="h-3.5 w-3.5 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{exportSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loadingExport || !exportPassword}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-text-primary py-2.5 text-xs font-semibold text-white transition-transform transition-opacity hover:opacity-90 disabled:opacity-40 active:scale-[0.98]"
                >
                  {loadingExport ? 'Generando backup cifrado...' : 'Exportar JSON cifrado'}
                </button>
              </form>
            </div>
          )}

          {view === 'importBackup' && (
            <div className="space-y-3 animate-vault-morph">
              <p className="text-[11px] leading-relaxed text-text-secondary">
                Sube un archivo de backup JSON y proporciona la contraseña maestra original del backup para restaurar.
                <span className="mt-1 block font-semibold text-red-600">¡Sobrescribirá todos tus datos locales actuales!</span>
              </p>
              <form onSubmit={handleImport} className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold uppercase text-text-secondary">
                    Archivo de backup (.json)
                  </label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => setBackupFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-text-secondary transition-colors file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-surface-hover file:px-3 file:py-2 file:text-xs file:font-semibold file:text-text-primary hover:file:bg-surface-active"
                  />
                </div>
                <input
                  type="password"
                  placeholder="Contraseña Maestra del backup"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-xs font-medium text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus:border-border"
                />
                
                {importError && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 p-2 text-[10px] font-medium text-red-700">
                    <svg className="h-3.5 w-3.5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{importError}</span>
                  </div>
                )}
                {importSuccess && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-green-100 bg-green-50 p-2 text-[10px] font-medium text-green-700">
                    <svg className="h-3.5 w-3.5 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{importSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loadingImport || !backupFile || !importPassword}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated py-2.5 text-xs font-semibold text-text-primary transition-colors transition-transform hover:bg-surface-hover disabled:opacity-50 active:scale-[0.98]"
                >
                  {loadingImport ? 'Descifrando e importando...' : 'Importar y Restaurar'}
                </button>
              </form>
            </div>
          )}

          {view === 'hardwareKey' && (
            <div className="space-y-4 animate-vault-morph">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-xs font-bold text-blue-900">¿Cómo funciona?</p>
                <p className="mt-1 text-[11px] leading-relaxed text-blue-800">
                  Tu Contraseña Maestra se cifra usando la extensión PRF de WebAuthn. La clave de descifrado se deriva localmente al conectar tu llave física (USB o NFC) e interactuar con ella. Este método garantiza un almacenamiento local ultra-seguro y zero-knowledge.
                </p>
              </div>
              {hardwareKeyRegistered ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-900">Llave física activa</p>
                      <p className="text-[11px] text-emerald-700">Puedes desbloquear conectando tu llave de seguridad.</p>
                    </div>
                  </div>
                  {hardwareKeyMessage && <p className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs font-semibold text-emerald-800">{hardwareKeyMessage}</p>}
                  {hardwareKeyError && <p className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-semibold text-red-700">{hardwareKeyError}</p>}
                  <button
                    type="button"
                    disabled={loadingHardwareKey}
                    onClick={async () => {
                      setLoadingHardwareKey(true)
                      setHardwareKeyError(null)
                      setHardwareKeyMessage(null)
                      try {
                        await onDisableHardwareKey?.()
                        setHardwareKeyMessage('Llave física desactivada.')
                        setView('health')
                      } catch (err) {
                        setHardwareKeyError(err instanceof Error ? err.message : 'Error al desactivar la llave física.')
                      } finally {
                        setLoadingHardwareKey(false)
                      }
                    }}
                    className="flex w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                  >
                    {loadingHardwareKey ? 'Desactivando...' : 'Desactivar llave física'}
                  </button>
                </div>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!hardwareKeyPassword) { setHardwareKeyError('Introduce tu Contraseña Maestra para continuar.'); return }
                    setLoadingHardwareKey(true)
                    setHardwareKeyError(null)
                    setHardwareKeyMessage(null)
                    try {
                      await onRegisterHardwareKey?.(hardwareKeyPassword)
                      setHardwareKeyPassword('')
                      setHardwareKeyMessage('¡Llave física registrada! La próxima vez que abras la app, podrás desbloquear con tu llave.')
                      setView('health')
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Error al registrar la llave física.'
                      setHardwareKeyError(msg)
                    } finally {
                      setLoadingHardwareKey(false)
                    }
                  }}
                >
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
                      Confirma tu Contraseña Maestra
                    </label>
                    <input
                      type="password"
                      value={hardwareKeyPassword}
                      onChange={(e) => setHardwareKeyPassword(e.target.value)}
                      placeholder="Contraseña Maestra"
                      className="w-full rounded-xl border border-black/[0.06] bg-white/80 px-3 py-2.5 text-sm text-text-primary outline-none transition-all focus:border-black/15 focus:ring-2 focus:ring-black/[0.035]"
                      autoComplete="current-password"
                    />
                    <p className="mt-1.5 text-[11px] text-text-tertiary">Se te solicitará conectar y tocar tu llave de seguridad física (USB/NFC) compatible con FIDO2.</p>
                  </div>
                  {hardwareKeyError && <p className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-semibold text-red-700">{hardwareKeyError}</p>}
                  <button
                    type="submit"
                    disabled={loadingHardwareKey || !hardwareKeyPassword}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-50"
                  >
                    {loadingHardwareKey ? 'Registrando llave física...' : 'Registrar mi llave de seguridad física'}
                  </button>
                </form>
              )}
            </div>
          )}
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

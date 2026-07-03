import { useState, useEffect, useMemo, useRef, type FormEvent }
 from 'react'
import { getFriendlyErrorMessage } from '../utils/errors'
import type { Identity, LocalVaultItem } from '../types'
import { buildPlaintextCsv, buildPlaintextJson, downloadPlaintextFile } from '../utils/exportVault'
import { passwordStrengthIssue, evaluatePassword, checkPasswordBreach } from '../utils/security'
import { useToast } from './ui/ToastProvider'

type PlaintextExportFormat = 'csv' | 'json'

const checkboxClassName =
  'h-5 w-5 shrink-0 cursor-pointer rounded-md border border-black/15 bg-white accent-slate-950 shadow-sm transition-transform duration-150 checked:scale-105 focus:outline-none focus:ring-4 focus:ring-black/[0.06]'

function passwordForPlatform(platform: Identity['platforms'][number] | undefined): string {
  return platform?.accessMethods?.find((method) => method?.type === 'PASSWORD')?.password ?? ''
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
  focusCsvExport?: boolean
  onCsvExportFocused?: () => void
  onUpdatePlatform?: (identityId: string, platformId: string, updates: any) => void | Promise<void>
  initialView?: 'health' | 'biometric' | 'hardwareKey' | 'credentials' | 'travel' | 'exportPlaintext' | 'exportBackup' | 'importBackup' | 'main'
  onEditPlatform?: (platformId: string) => void
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
  focusCsvExport = false,
  onCsvExportFocused,
  onUpdatePlatform,
  initialView = 'health',
  onEditPlatform,
}: SettingsModalProps) {
  const [exportPassword, setExportPassword] = useState('')
  const [importPassword, setImportPassword] = useState('')
  const [backupFile, setBackupFile] = useState<File | null>(null)
  const [hideWeakPasswordWarnings, setHideWeakPasswordWarnings] = useState(() => {
    return typeof window !== 'undefined' && window.localStorage.getItem('contras.hideWeakPasswordWarnings') === 'true'
  })
  const [requireSecretAuth, setRequireSecretAuth] = useState(() => {
    return typeof window !== 'undefined' && window.localStorage.getItem('contras.requireSecretAuth') !== 'false'
  })
  const [autoLockTimeout, setAutoLockTimeout] = useState(() => {
    if (typeof window === 'undefined') return 5
    const val = window.localStorage.getItem('contras.autoLockTimeout')
    return val ? parseInt(val, 10) : 5
  })
  const [blurLock, setBlurLock] = useState(() => {
    return typeof window !== 'undefined' && window.localStorage.getItem('contras.blurLock') === 'true'
  })
  const [plaintextFormat, setPlaintextFormat] = useState<PlaintextExportFormat>('csv')
  const [selectedIdentityIds, setSelectedIdentityIds] = useState<string[]>([])
  const [securityModalOpen, setSecurityModalOpen] = useState(false)
  const [securityPassword, setSecurityPassword] = useState('')
  const [currentMasterPassword, setCurrentMasterPassword] = useState('')
  const [nextMasterPassword, setNextMasterPassword] = useState('')
  const [recoveryPhrase, setRecoveryPhrase] = useState('')
  const [travelPassword, setTravelPassword] = useState('')
  const { showToast } = useToast()
  
        const [exportSuccess, setExportSuccess] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [plaintextExportError, setPlaintextExportError] = useState<string | null>(null)
  const [plaintextExportSuccess, setPlaintextExportSuccess] = useState<string | null>(null)
  const [weakPasswordsModalOpen, setWeakPasswordsModalOpen] = useState(false)
  const [selectedWeakPasswords, setSelectedWeakPasswords] = useState<string[]>([])
  
  const [breachedPasswords, setBreachedPasswords] = useState<Array<{ identityEmail: string, platform: Identity['platforms'][number], count: number }>>([])
  const [isCheckingBreaches, setIsCheckingBreaches] = useState(false)
  const [lastBreachCheck, setLastBreachCheck] = useState<string | null>(null)
  const [breachAuditModalOpen, setBreachAuditModalOpen] = useState(false)
  
  const [highlightCsvExport, setHighlightCsvExport] = useState(false)
  const csvExportRef = useRef<HTMLDivElement>(null)
      
  const [loadingExport, setLoadingExport] = useState(false)
  const [loadingImport, setLoadingImport] = useState(false)
  const [loadingPlaintextExport, setLoadingPlaintextExport] = useState(false)
  const [loadingPasswordChange, setLoadingPasswordChange] = useState(false)
  const [loadingTravelMode, setLoadingTravelMode] = useState(false)
  const [loadingBiometric, setLoadingBiometric] = useState(false)
  const [biometricPassword, setBiometricPassword] = useState('')
      const [loadingHardwareKey, setLoadingHardwareKey] = useState(false)
  const [hardwareKeyPassword, setHardwareKeyPassword] = useState('')
      const [view, setView] = useState<'main' | 'health' | 'travel' | 'credentials' | 'exportPlaintext' | 'exportBackup' | 'importBackup' | 'biometric' | 'hardwareKey'>(initialView)
      const [activeTab, setActiveTab] = useState<'settings' | 'profile'>('settings')

  useEffect(() => {
    if (isOpen) {
      setView(initialView)
      if (initialView === 'biometric' || initialView === 'hardwareKey') {
        setActiveTab('settings')
      }
    }
  }, [isOpen, initialView])

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
      setBreachedPasswords([])
    }
  }, [])
  
  const performBreachAudit = async () => {
    setIsCheckingBreaches(true)
    const newBreached: Array<{ identityEmail: string, platform: Identity['platforms'][number], count: number }> = []
    
    const allAccounts = (identities || []).flatMap((identity) =>
      (identity?.platforms || []).map((platform) => ({
        identityEmail: identity?.email,
        platform,
        password: passwordForPlatform(platform),
      }))
    )
    
    for (const acc of allAccounts) {
      if (acc.password) {
        const count = await checkPasswordBreach(acc.password)
        if (count > 0) {
          newBreached.push({ identityEmail: acc.identityEmail || '', platform: acc.platform, count })
        }
      }
    }
    
    setBreachedPasswords(newBreached)
    setLastBreachCheck(new Date().toISOString())
    setIsCheckingBreaches(false)
    if (newBreached.length > 0) {
      setBreachAuditModalOpen(true)
    } else {
      showToast('¡Felicidades! Ninguna de tus contraseñas aparece en filtraciones públicas.', 'success')
    }
  }

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
    totalAccountsCount,
  } = useMemo(() => {
    const allAccounts = (identities || []).flatMap((identity) =>
      (identity?.platforms || []).map((platform) => ({
        identityEmail: identity?.email,
        platform,
        password: passwordForPlatform(platform),
      })),
    )
    const entries = allAccounts.filter((entry) => entry?.password)

    const reused = entries.filter((entry, _, all) =>
      all.some((other) => other !== entry && other?.password === entry?.password),
    )
    const weak = entries.filter((entry) => passwordStrengthIssue(entry?.password || '') && !entry?.platform?.ignoreWeakPasswordWarning)
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
      totalAccountsCount: allAccounts.length,
    }
  }, [identities])

  useEffect(() => {
    if (!isOpen || !focusCsvExport) return
    setView('exportPlaintext')
    setPlaintextFormat('csv')
    setHighlightCsvExport(true)
    window.setTimeout(() => {
      csvExportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      onCsvExportFocused?.()
    }, 120)
    const timer = window.setTimeout(() => setHighlightCsvExport(false), 2200)
    return () => window.clearTimeout(timer)
  }, [focusCsvExport, isOpen, onCsvExportFocused])

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
      showToast('Se requiere la contraseña maestra para cifrar la exportación.', 'error')
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
      showToast('Selecciona al menos una identidad para exportar.', 'error')
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
      showToast('Introduce tu Contraseña Maestra para autorizar la exportación.', 'error')
      return
    }

    let plaintext = ''
    setLoadingPlaintextExport(true)
    try {
      const verified = await onVerifyMasterPassword(securityPassword)
      if (!verified) {
        showToast('Contraseña Maestra incorrecta.', 'error')
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
      showToast('Selecciona un archivo de copia de seguridad.', 'error')
      return
    }
    if (!importPassword) {
      showToast('Introduce la contraseña maestra para descifrar el backup.', 'error')
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
    
    
    if (nextMasterPassword.length < 8) {
      showToast('La nueva Contraseña Maestra debe tener al menos 8 caracteres.', 'error')
      return
    }
    if (!recoveryPhrase.trim()) {
      showToast('Introduce tu frase de recuperación para regenerar el kit de emergencia.', 'error')
      return
    }

    setLoadingPasswordChange(true)
    try {
      await onChangeMasterPassword(currentMasterPassword, nextMasterPassword, recoveryPhrase)
      showToast('Contraseña Maestra actualizada y bóveda re-cifrada correctamente.', 'success')
      setCurrentMasterPassword('')
      setNextMasterPassword('')
      setRecoveryPhrase('')
    } catch (error) {
      showToast(getFriendlyErrorMessage(error, 'No se pudo cambiar la Contraseña Maestra.'))
    } finally {
      setLoadingPasswordChange(false)
    }
  }

  const handleDisableTravelMode = async (event: FormEvent) => {
    event.preventDefault()
    
    setLoadingTravelMode(true)
    try {
      await onDisableTravelMode(travelPassword)
      setTravelPassword('')
      setBiometricPassword('')
    } catch (error) {
      showToast(getFriendlyErrorMessage(error, 'No se pudo desactivar el Modo Viaje.'))
    } finally {
      setLoadingTravelMode(false)
    }
  }

  const MenuItem = ({ title, subtitle, onClick }: { title: string, subtitle: string, onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between bg-transparent p-4 text-left transition-colors hover:bg-slate-50/50"
    >
      <div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{subtitle}</p>
      </div>
      <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              {/* Puntuación y Resumen de Seguridad Integrados */}
              <div className="overflow-hidden rounded-3xl border border-black/[0.05] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
                {/* Header de la tarjeta */}
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 px-5 py-6 text-white relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-30"></div>
                  <div className="relative flex items-center justify-between">
                    <div className="max-w-[70%]">
                      <h3 className="text-[13px] font-bold uppercase tracking-[0.15em] text-indigo-100">Auditoría de Seguridad</h3>
                      <h4 className="mt-1 text-lg font-black leading-tight">Tu Bóveda está protegida</h4>
                      <p className="mt-1.5 text-xs text-indigo-100 leading-relaxed">
                        <span className="font-semibold text-white">{totalAccountsCount}</span> cuentas en total. <span className="font-semibold text-white">{totalPasswordsCount}</span> usan contraseña, de las cuales <span className="font-semibold text-emerald-300">{securePasswordsCount}</span> son fuertes.
                      </p>
                    </div>
                    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[1.25rem] bg-white text-indigo-600 shadow-xl ring-4 ring-white/20">
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Score</span>
                      <span className="text-2xl font-black leading-none mt-0.5">{healthScore}</span>
                    </div>
                  </div>
                </div>

                {/* Grid de Auditoría (Inside the same card) */}
                <div className="grid grid-cols-3 divide-x divide-black/[0.05] bg-slate-50/50">
                  <div className="p-4 text-center transition-colors hover:bg-white">
                    <p className="text-2xl font-black text-red-600">{reusedPasswords.length}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-red-800">Reutilizadas</p>
                  </div>
                  <div className="p-4 text-center transition-colors hover:bg-white">
                    <p className="text-2xl font-black text-amber-500">{weakPasswords.length}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">Débiles</p>
                  </div>
                  <div className="p-4 text-center transition-colors hover:bg-white">
                    <p className="text-2xl font-black text-blue-500">{oldPasswords.length}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">Antiguas</p>
                  </div>
                </div>
              </div>

              {weakPasswords.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setWeakPasswordsModalOpen(true)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-left transition-all hover:bg-amber-100 active:scale-[0.99]"
                >
                  <span>
                    <span className="block text-sm font-black text-amber-900">{weakPasswords.length} Contraseñas Débiles Detectadas</span>
                    <span className="mt-0.5 block text-[11px] font-medium text-amber-800">Revisar algoritmicamente longitud y complejidad.</span>
                  </span>
                  <span className="shrink-0 rounded-xl bg-white/80 px-3 py-1.5 text-[11px] font-bold text-amber-900 shadow-sm">Revisar</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={performBreachAudit}
                disabled={isCheckingBreaches}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-red-100 bg-slate-50 p-3 text-left transition-all hover:bg-slate-100 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span>
                  <span className="block text-sm font-black text-slate-900 flex items-center gap-2">
                    Auditoría de Contraseñas Expuestas
                    {isCheckingBreaches && (
                      <svg className="h-4 w-4 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-medium text-slate-500">
                    {lastBreachCheck 
                      ? `Última revisión: ${new Date(lastBreachCheck).toLocaleDateString()}` 
                      : 'Busca tus contraseñas en filtraciones mundiales (Pwned)'}
                  </span>
                </span>
                {breachedPasswords.length > 0 && !isCheckingBreaches ? (
                  <span className="shrink-0 rounded-xl bg-red-100 px-3 py-1.5 text-[11px] font-bold text-red-900 shadow-sm flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse"></span>
                    {breachedPasswords.length}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm border border-black/5">Escanear</span>
                )}
              </button>
              {/* Ajustes de Configuración */}
              {/* Navegación por pestañas */}
              <div className="flex w-full items-center justify-center gap-1 rounded-xl bg-slate-100/80 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                    activeTab === 'settings'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
                >
                  Ajustes y Seguridad
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                    activeTab === 'profile'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
                >
                  Mi Perfil
                </button>
              </div>

              {activeTab === 'settings' ? (
                <div className="pt-2 space-y-6 animate-vault-morph">
                  
                  {/* PREFERENCIAS */}
                  <section>
                    <h3 className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Preferencias</h3>
                    <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-sm">
                      <label className="flex w-full items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-50/50 cursor-pointer">
                        <div>
                          <span className="block text-sm font-bold text-slate-800">Ocultar advertencias visuales</span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">No mostrar alertas naranjas en cuentas débiles.</span>
                        </div>
                        <input
                          type="checkbox"
                          className={checkboxClassName}
                          checked={hideWeakPasswordWarnings}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setHideWeakPasswordWarnings(checked)
                            if (checked) {
                              window.localStorage.setItem('contras.hideWeakPasswordWarnings', 'true')
                            } else {
                              window.localStorage.removeItem('contras.hideWeakPasswordWarnings')
                            }
                            window.dispatchEvent(new Event('contras:weak-passwords-toggled'))
                          }}
                        />
                      </label>
                    </div>
                  </section>

                  {/* SEGURIDAD Y ACCESO */}
                  <section>
                    <h3 className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Seguridad y Acceso</h3>
                    <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-sm flex flex-col divide-y divide-black/[0.04]">
                      <div className="flex w-full items-center justify-between gap-3 p-4">
                        <div>
                          <span className="block text-sm font-bold text-slate-800">Bloqueo por inactividad</span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">Tiempo para bloquear automáticamente.</span>
                        </div>
                        <select
                          value={autoLockTimeout}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10)
                            setAutoLockTimeout(val)
                            window.localStorage.setItem('contras.autoLockTimeout', val.toString())
                            window.dispatchEvent(new Event('contras:auto-lock-changed'))
                          }}
                          className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                        >
                          <option value={1}>1 minuto</option>
                          <option value={5}>5 minutos</option>
                          <option value={15}>15 minutos</option>
                          <option value={30}>30 minutos</option>
                          <option value={0}>Nunca (No recomendado)</option>
                        </select>
                      </div>

                      <label className="flex w-full items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-50/50 cursor-pointer">
                        <div>
                          <span className="block text-sm font-bold text-slate-800">Bloqueo por desenfoque</span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">Bloquear bóveda al cambiar de pestaña.</span>
                        </div>
                        <input
                          type="checkbox"
                          className={checkboxClassName}
                          checked={blurLock}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setBlurLock(checked)
                            window.localStorage.setItem('contras.blurLock', checked ? 'true' : 'false')
                            window.dispatchEvent(new Event('contras:blur-lock-changed'))
                          }}
                        />
                      </label>

                      <label className="flex w-full items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-50/50 cursor-pointer">
                        <div>
                          <span className="block text-sm font-bold text-slate-800">Requerir clave al revelar</span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">Pedir autenticación al ver/copiar contraseñas.</span>
                        </div>
                        <input
                          type="checkbox"
                          className={checkboxClassName}
                          checked={requireSecretAuth}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setRequireSecretAuth(checked)
                            window.localStorage.setItem('contras.requireSecretAuth', checked ? 'true' : 'false')
                          }}
                        />
                      </label>

                      {biometricAvailable && (
                        <MenuItem
                          title={biometricRegistered ? 'Llave local activada' : 'Activar llave local'}
                          subtitle={biometricRegistered ? 'Face ID · Huella activos.' : 'Desbloquea rápido usando biometría.'}
                          onClick={() => { setBiometricPassword(''); setView('biometric') }}
                        />
                      )}
                      {hardwareKeyAvailable && (
                        <MenuItem
                          title={hardwareKeyRegistered ? 'Llave Física Activada' : 'Activar Llave Física'}
                          subtitle={hardwareKeyRegistered ? 'Llave de seguridad FIDO2 (YubiKey) activa.' : 'Registra una llave de seguridad física USB/NFC.'}
                          onClick={() => { setHardwareKeyPassword(''); setView('hardwareKey') }}
                        />
                      )}
                      <MenuItem
                        title="Modo Viaje"
                        subtitle="Oculta bóvedas sensibles al cruzar fronteras."
                        onClick={() => setView('travel')}
                      />
                    </div>
                  </section>
                </div>
              ) : (
                <div className="pt-2 space-y-6 animate-vault-morph">
                  {/* DATOS E IMPORTACIÓN */}
                  <section>
                    <h3 className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Datos y Copias de Seguridad</h3>
                    <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-sm flex flex-col divide-y divide-black/[0.04]">
                      <MenuItem
                        title="Importación Masiva (TSV)"
                        subtitle="Pega filas de Google Docs u Hojas de cálculo."
                        onClick={() => {
                          onClose()
                          onOpenImportText()
                        }}
                      />
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
                  </section>
                  
                  <section>
                    <h3 className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Gestión de Cuenta</h3>
                    <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-sm flex flex-col divide-y divide-black/[0.04]">
                      <MenuItem
                        title="Credenciales y Recuperación"
                        subtitle="Cambia tu Contraseña Maestra local."
                        onClick={() => setView('credentials')}
                      />
                    </div>
                  </section>
                </div>
              )}
            </div>
          )}

          {view === 'biometric' && (
            <div className="space-y-4 animate-vault-morph">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-xs font-bold text-blue-900">¿Cómo funciona?</p>
                <p className="mt-1 text-[11px] leading-relaxed text-blue-800">
                  Tu Contraseña Maestra se cifra con una clave derivada de una llave de acceso local protegida por Face ID, huella o Windows Hello y se guarda <strong>solo en este dispositivo</strong>. En Apple debería aparecer como una llave de acceso de Contras en Contraseñas.
                </p>
              </div>
              {biometricRegistered ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-900">Llave local activa</p>
                      <p className="text-[11px] text-emerald-700">Puedes desbloquear con esta llave de acceso en este dispositivo. En Apple Passwords debe aparecer como Contras.</p>
                    </div>
                  </div>
                  
                  
                  <button
                    type="button"
                    disabled={loadingBiometric}
                    onClick={async () => {
                      setLoadingBiometric(true)
                      
                      
                      try {
                        await onDisableBiometric?.()
                        showToast('Llave local desactivada. Si el sistema creó una passkey, puedes eliminarla también desde los ajustes del dispositivo.', 'success')
                        setView('health')
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Error al desactivar la llave local.', 'error')
                      } finally {
                        setLoadingBiometric(false)
                      }
                    }}
                    className="flex w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                  >
                    {loadingBiometric ? 'Desactivando...' : 'Desactivar llave local'}
                  </button>
                </div>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!biometricPassword) { showToast('Introduce tu Contraseña Maestra para continuar.', 'error'); return }
                    setLoadingBiometric(true)
                    
                    
                    try {
                      await onRegisterBiometric?.(biometricPassword)
                      setBiometricPassword('')
                      showToast('Llave local activada. La próxima vez Apple Passwords/Face ID podrá mostrar la llave de Contras para desbloquear este dispositivo.', 'success')
                      setView('health')
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Error al activar la llave local.'
                      showToast(msg, 'error')
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
                  
                  <button
                    type="submit"
                    disabled={loadingBiometric || !biometricPassword}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-50"
                  >
                    {loadingBiometric ? 'Registrando llave local...' : 'Activar llave local'}
                  </button>
                </form>
              )}
            </div>
          )}



          {view === 'travel' && (
            <div ref={csvExportRef} className={`space-y-3 animate-vault-morph rounded-2xl transition-all duration-300 ${highlightCsvExport ? 'ring-4 ring-amber-300 bg-amber-50/50 p-3' : ''}`}>
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
            <div ref={csvExportRef} className={`space-y-3 animate-vault-morph rounded-2xl transition-all duration-300 ${highlightCsvExport ? 'ring-4 ring-amber-300 bg-amber-50/50 p-3' : ''}`}>
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
            <div ref={csvExportRef} className={`space-y-3 animate-vault-morph rounded-2xl transition-all duration-300 ${highlightCsvExport ? 'ring-4 ring-amber-300 bg-amber-50/50 p-3' : ''}`}>
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
            <div ref={csvExportRef} className={`space-y-3 animate-vault-morph rounded-2xl transition-all duration-300 ${highlightCsvExport ? 'ring-4 ring-amber-300 bg-amber-50/50 p-3' : ''}`}>
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
            <div ref={csvExportRef} className={`space-y-3 animate-vault-morph rounded-2xl transition-all duration-300 ${highlightCsvExport ? 'ring-4 ring-amber-300 bg-amber-50/50 p-3' : ''}`}>
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
                  
                  
                  <button
                    type="button"
                    disabled={loadingHardwareKey}
                    onClick={async () => {
                      setLoadingHardwareKey(true)
                      
                      
                      try {
                        await onDisableHardwareKey?.()
                        showToast('Llave física desactivada.', 'success')
                        setView('health')
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Error al desactivar la llave física.', 'error')
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
                    if (!hardwareKeyPassword) { showToast('Introduce tu Contraseña Maestra para continuar.', 'error'); return }
                    setLoadingHardwareKey(true)
                    
                    
                    try {
                      await onRegisterHardwareKey?.(hardwareKeyPassword)
                      setHardwareKeyPassword('')
                      showToast('¡Llave física registrada! La próxima vez que abras la app, podrás desbloquear con tu llave.', 'success')
                      setView('health')
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Error al registrar la llave física.'
                      showToast(msg, 'error')
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
      {weakPasswordsModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-vault-morph">
          <div className="flex max-h-[82vh] w-full max-w-2xl flex-col rounded-3xl border border-amber-100 bg-white p-6 text-left shadow-[0_30px_90px_rgba(15,23,42,0.22)]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-text-primary">Contraseñas débiles</h2>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">Revisa estas cuentas y actualiza cada contraseña con una clave más larga y única.</p>
              </div>
              <button
                type="button"
                onClick={() => setWeakPasswordsModalOpen(false)}
                className="rounded-xl p-2 text-text-secondary transition-colors hover:bg-surface-hover"
                aria-label="Cerrar análisis de contraseñas débiles"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {weakPasswords.length > 0 && (
              <div className="mb-3 flex items-center justify-between rounded-xl bg-surface p-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    checked={selectedWeakPasswords.length === weakPasswords.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedWeakPasswords(weakPasswords.map(wp => `${wp.identityEmail}-${wp.platform!.id}`))
                      } else {
                        setSelectedWeakPasswords([])
                      }
                    }}
                  />
                  Seleccionar Todas
                </label>
                <button
                  type="button"
                  disabled={selectedWeakPasswords.length === 0}
                  onClick={async () => {
                    for (const wpId of selectedWeakPasswords) {
                      const [email, platformId] = wpId.split('-')
                      const identity = identities.find(id => id.email === email)
                      const platform = weakPasswords.find(wp => wp.platform?.id === platformId)?.platform
                      if (identity && platform) {
                        await onUpdatePlatform?.(identity.id, platform.id, { ...platform, ignoreWeakPasswordWarning: true })
                      }
                    }
                    showToast(`${selectedWeakPasswords.length} aviso(s) ignorado(s).`, 'success')
                    setSelectedWeakPasswords([])
                  }}
                  className="rounded-lg bg-amber-100 px-4 py-2 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Ignorar Seleccionadas
                </button>
              </div>
            )}

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
              {weakPasswords.map((entry) => {
                const password = entry?.password || ''
                const { reasons, recommendations } = evaluatePassword(password)
                const platformId = entry?.platform?.id
                const key = `${entry?.identityEmail}-${platformId}`
                const isSelected = selectedWeakPasswords.includes(key)

                return (
                  <div key={key} className={`rounded-2xl border ${isSelected ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-amber-100'} bg-amber-50/50 p-4 transition-all group`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedWeakPasswords([...selectedWeakPasswords, key])
                          else setSelectedWeakPasswords(selectedWeakPasswords.filter(id => id !== key))
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-amber-950">{entry?.platform?.name || 'Plataforma desconocida'}</p>
                            <p className="mt-0.5 truncate text-[11px] font-medium text-amber-800">{entry?.identityEmail || 'Identidad sin email'}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-amber-900 shadow-sm">Débil</span>
                        </div>
                        
                        <div className="mt-3 space-y-2">
                          <div className="rounded-lg bg-white/60 p-2 text-[11px] text-amber-900">
                            <strong>Problemas detectados:</strong>
                            <ul className="mt-1 list-disc pl-4 space-y-0.5">
                              {reasons.length > 0 ? reasons.map((r, i) => <li key={i}>{r}</li>) : <li>No cumple la política de seguridad</li>}
                            </ul>
                          </div>
                          {recommendations.length > 0 && (
                            <div className="rounded-lg bg-white/60 p-2 text-[11px] text-emerald-800">
                              <strong>Sugerencias:</strong>
                              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                                {recommendations.map((r, i) => <li key={i}>{r}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {onUpdatePlatform && entry?.identityEmail && platformId && (
                            <button
                              type="button"
                              onClick={async () => {
                                const identity = identities.find(id => id.email === entry.identityEmail)
                                if (identity) {
                                  await onUpdatePlatform(identity.id, platformId, { ...entry.platform!, ignoreWeakPasswordWarning: true })
                                  showToast('Aviso de contraseña débil ignorado.', 'success')
                                }
                              }}
                              className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm transition-colors hover:bg-amber-100"
                            >
                              Ignorar este aviso
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (onEditPlatform) {
                                onEditPlatform(platformId)
                                onClose()
                              }
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-black/5 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.112l-2.83.849a.5.5 0 01-.632-.632l.849-2.83a4.5 4.5 0 011.112-1.89l13.43-13.43z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125L16.875 4.5" />
                            </svg>
                            Editar plataforma
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {weakPasswords.length === 0 && (
                <div className="py-8 text-center text-sm text-text-tertiary">
                  ¡No se encontraron contraseñas débiles!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {breachAuditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-vault-morph">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <header className="border-b border-black/5 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Resultados de Auditoría</h3>
                <p className="text-[11px] font-medium text-slate-500">Filtraciones en Have I Been Pwned</p>
              </div>
              <button
                type="button"
                onClick={() => setBreachAuditModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-slate-500 hover:bg-black/10 hover:text-slate-900"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>
            <div className="max-h-[420px] overflow-y-auto p-2 scrollbar-thin">
              {breachedPasswords.map((entry) => {
                const key = `${entry.identityEmail}-${entry.platform.id}`
                return (
                  <div key={key} className="flex gap-4 rounded-2xl p-3 transition-colors hover:bg-slate-50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1 overflow-hidden pt-0.5">
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-bold text-slate-900">{entry.platform.name}</p>
                        <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">
                          {entry.count.toLocaleString()} filtraciones
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{entry.identityEmail}</p>
                      <p className="mt-1 text-[11px] font-medium leading-relaxed text-red-600/90">
                        ¡Cámbiala de inmediato! Esta contraseña circula públicamente por internet.
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="border-t border-black/5 p-4 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setBreachAuditModalOpen(false)}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
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






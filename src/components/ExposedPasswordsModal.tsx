import { useState, useMemo } from 'react'
import type { Identity } from '../types'
import { useVault } from '../context/VaultContext'

interface ExposedPasswordsModalProps {
  isOpen: boolean
  onClose: () => void
  onEditPlatform?: (platformId: string) => void
}

type BreachedEntry = {
  identityEmail: string
  platform: Identity['platforms'][number]
  count: number
}

export function ExposedPasswordsModal({ isOpen, onClose, onEditPlatform }: ExposedPasswordsModalProps) {
  const {
    identities,
    updatePlatform,
    isScanningExposed,
    exposedScanProgress,
    exposedScanTotal,
    runExposedPasswordsScan
  } = useVault()

  const [selectedBreaches, setSelectedBreaches] = useState<string[]>([])
  const [localHasStartedScan, setLocalHasStartedScan] = useState(false)

  const breachedPasswords = useMemo(() => {
    const newBreached: BreachedEntry[] = []
    for (const identity of identities || []) {
      for (const platform of identity.platforms || []) {
        if (
          platform.exposedBreachCount !== undefined &&
          platform.exposedBreachCount !== null &&
          platform.exposedBreachCount > 0 &&
          !platform.ignoreExposedPasswordWarning
        ) {
          newBreached.push({
            identityEmail: identity.email,
            platform,
            count: platform.exposedBreachCount
          })
        }
      }
    }
    return newBreached
  }, [identities])

  const hasAnyScanned = useMemo(() => {
    return (identities || []).some(id =>
      (id.platforms || []).some(p => p.exposedBreachCount !== undefined && p.exposedBreachCount !== null)
    )
  }, [identities])

  const hasStartedScan = localHasStartedScan || hasAnyScanned
  const scanComplete = !isScanningExposed && hasAnyScanned
  const loading = isScanningExposed
  const scanProgress = exposedScanProgress
  const totalScanCount = exposedScanTotal

  const runScan = () => {
    setLocalHasStartedScan(true)
    void runExposedPasswordsScan()
  }

  const handleIgnoreSelected = async () => {
    for (const key of selectedBreaches) {
      const [email, platformId] = key.split('-')
      const identity = identities.find(id => id.email === email)
      if (identity) {
        const platform = identity.platforms.find(p => p.id === platformId)
        if (platform) {
          await updatePlatform(identity.id, platform.id, {
            ...platform,
            ignoreExposedPasswordWarning: true
          })
        }
      }
    }
    setSelectedBreaches([])
  }


  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-vault-morph">
      <div className="flex max-h-[82vh] w-full max-w-2xl flex-col rounded-3xl border border-red-100 bg-white p-6 text-left shadow-[0_30px_90px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-[#1c1c1e]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text-primary dark:text-slate-100">Auditoría de Filtraciones</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              Comprueba si tus contraseñas han aparecido en brechas de datos conocidas (Have I Been Pwned).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runScan}
              disabled={loading}
              className="rounded-xl bg-red-100 px-3 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 flex items-center gap-2"
              aria-label="Refrescar auditoría"
            >
              {loading && <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-700 border-t-transparent dark:border-red-400"></div>}
              Sincronizar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-text-secondary transition-colors hover:bg-surface-hover"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {loading && !scanComplete ? (
          <div className="flex h-64 flex-col items-center justify-center space-y-5">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <svg className="absolute inset-0 h-full w-full -rotate-90 text-slate-100 dark:text-slate-800" viewBox="0 0 36 36">
                <path className="stroke-current" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="stroke-red-500 dark:stroke-red-400" strokeWidth="3" fill="none" strokeDasharray={`${Math.max(1, totalScanCount > 0 ? (scanProgress / totalScanCount) * 100 : 0)}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" style={{ transition: 'stroke-dasharray 0.3s ease-out' }} />
              </svg>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {totalScanCount > 0 ? Math.round((scanProgress / totalScanCount) * 100) : 0}%
              </span>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Escaneando bóveda de forma anónima...</p>
              <p className="text-xs text-slate-400 mt-1">Revisada {scanProgress} de {totalScanCount} cuentas</p>
            </div>
          </div>
        ) : !hasStartedScan ? (
          <div className="flex h-[300px] flex-col items-center justify-center text-center animate-in fade-in duration-300">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-text-primary">¿Listos para revisar?</h3>
            <p className="max-w-[280px] text-sm text-text-tertiary mt-2">
              Comprobaremos tus contraseñas contra bases de datos públicas de filtraciones de forma segura.
            </p>
            <button onClick={() => { setLocalHasStartedScan(true); runScan(); }} className="mt-6 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-indigo-700">
              Revisar
            </button>
          </div>
        ) : breachedPasswords.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center text-center animate-in fade-in duration-300">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-text-primary">¡Felicidades!</h3>
            <p className="max-w-[280px] text-sm text-text-tertiary mt-2">
              Ninguna de tus contraseñas activas aparece en filtraciones de datos públicas. Tu bóveda es segura.
            </p>
            <button onClick={onClose} className="mt-6 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-slate-800">
              Cerrar Auditoría
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between rounded-xl bg-surface p-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  checked={selectedBreaches.length === breachedPasswords.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedBreaches(breachedPasswords.map(b => `${b.identityEmail}-${b.platform.id}`))
                    } else {
                      setSelectedBreaches([])
                    }
                  }}
                />
                Seleccionar Todas
              </label>
              <button
                type="button"
                disabled={selectedBreaches.length === 0}
                onClick={handleIgnoreSelected}
                className="rounded-lg bg-red-100 px-4 py-2 text-xs font-bold text-red-800 transition-colors hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Ignorar Seleccionadas
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
              {breachedPasswords.map((entry) => {
                const key = `${entry.identityEmail}-${entry.platform.id}`
                const isSelected = selectedBreaches.includes(key)

                return (
                  <div key={key} className={`rounded-2xl border ${isSelected ? 'border-red-400 ring-2 ring-red-400/20' : 'border-red-100'} bg-red-50/50 p-4 transition-all group`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedBreaches([...selectedBreaches, key])
                          else setSelectedBreaches(selectedBreaches.filter(id => id !== key))
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-red-950">{entry.platform.name}</p>
                            <p className="mt-0.5 truncate text-[11px] font-medium text-red-800">{entry.identityEmail}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-sm">
                            ¡Filtrada!
                          </span>
                        </div>
                        
                        <div className="mt-3 rounded-lg bg-white/60 p-2 text-[11px] font-medium leading-relaxed text-red-900">
                          Esta contraseña ha aparecido en <strong>{entry.count.toLocaleString()} filtraciones</strong> de datos públicas. Es altamente vulnerable a ataques de diccionario.
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              const identity = identities.find(id => id.email === entry.identityEmail)
                              if (identity) {
                                await updatePlatform(identity.id, entry.platform.id, {
                                  ...entry.platform,
                                  ignoreExposedPasswordWarning: true
                                })
                              }
                            }}
                            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 shadow-sm transition-colors hover:bg-red-100"
                          >
                            Ignorar este aviso
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (onEditPlatform) {
                                onEditPlatform(entry.platform.id)
                                onClose()
                              }
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-black/5 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.112l-2.83.849a.5.5 0 01-.632-.632l.849-2.83a4.5 4.5 0 011.112-1.89l13.43-13.43z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125L16.875 4.5" />
                            </svg>
                            Cambiar contraseña
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

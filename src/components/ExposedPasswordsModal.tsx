import { useState, useEffect } from 'react'
import type { Identity } from '../types'
import { checkPasswordBreach } from '../utils/security'

function passwordForPlatform(platform: Identity['platforms'][number] | undefined): string {
  return platform?.accessMethods?.find((method) => method?.type === 'PASSWORD')?.password ?? ''
}

interface ExposedPasswordsModalProps {
  isOpen: boolean
  onClose: () => void
  identities: Identity[]
  onUpdatePlatform?: (identityId: string, platformId: string, platform: Identity['platforms'][number]) => Promise<void>
  onEditPlatform?: (platformId: string) => void
}

type BreachedEntry = {
  identityEmail: string
  platform: Identity['platforms'][number]
  count: number
}

export function ExposedPasswordsModal({ isOpen, onClose, identities, onUpdatePlatform, onEditPlatform }: ExposedPasswordsModalProps) {
  const [loading, setLoading] = useState(true)
  const [breachedPasswords, setBreachedPasswords] = useState<BreachedEntry[]>([])
  const [selectedBreaches, setSelectedBreaches] = useState<string[]>([])
  const [scanComplete, setScanComplete] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setBreachedPasswords([])
      setScanComplete(false)
      setSelectedBreaches([])
      return
    }

    let isMounted = true

    const runScan = async () => {
      setLoading(true)
      const newBreached: BreachedEntry[] = []
      
      const allAccounts = (identities || []).flatMap((identity) =>
        (identity?.platforms || []).map((platform) => ({
          identityEmail: identity?.email,
          platform,
          password: passwordForPlatform(platform),
        }))
      )
      
      for (const acc of allAccounts) {
        if (!isMounted) break
        if (acc.password && !acc.platform.ignoreExposedPasswordWarning) {
          try {
            const count = await checkPasswordBreach(acc.password)
            if (count > 0) {
              newBreached.push({ identityEmail: acc.identityEmail || '', platform: acc.platform, count })
            }
          } catch (e) {
            console.error('Error scanning password', e)
          }
        }
      }
      
      if (isMounted) {
        setBreachedPasswords(newBreached)
        setLoading(false)
        setScanComplete(true)
      }
    }

    runScan()

    return () => {
      isMounted = false
    }
  }, [isOpen, identities])

  if (!isOpen) return null

  const handleIgnoreSelected = async () => {
    if (!onUpdatePlatform) return
    for (const key of selectedBreaches) {
      const [email, platformId] = key.split('-')
      const identity = identities.find(id => id.email === email)
      const entry = breachedPasswords.find(b => b.platform.id === platformId)
      if (identity && entry) {
        await onUpdatePlatform(identity.id, entry.platform.id, { ...entry.platform, ignoreExposedPasswordWarning: true })
      }
    }
    setBreachedPasswords(prev => prev.filter(b => !selectedBreaches.includes(`${b.identityEmail}-${b.platform.id}`)))
    setSelectedBreaches([])
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-vault-morph">
      <div className="flex max-h-[82vh] w-full max-w-2xl flex-col rounded-3xl border border-red-100 bg-white p-6 text-left shadow-[0_30px_90px_rgba(15,23,42,0.22)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text-primary">Auditoría de Filtraciones</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              Comprueba si tus contraseñas han aparecido en brechas de datos conocidas (Have I Been Pwned).
            </p>
          </div>
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
        
        {loading && !scanComplete ? (
          <div className="flex h-64 flex-col items-center justify-center space-y-4">
            <span className="h-10 w-10 rounded-full border-4 border-red-500/20 border-t-red-600 animate-spin" />
            <p className="text-sm font-bold text-slate-600">Escaneando bóveda de forma anónima...</p>
            <p className="text-xs text-slate-400">Usando K-Anonymity para proteger tu privacidad.</p>
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
                              if (onUpdatePlatform) {
                                const identity = identities.find(id => id.email === entry.identityEmail)
                                if (identity) {
                                  await onUpdatePlatform(identity.id, entry.platform.id, { ...entry.platform, ignoreExposedPasswordWarning: true })
                                  setBreachedPasswords(prev => prev.filter(b => b.platform.id !== entry.platform.id))
                                }
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

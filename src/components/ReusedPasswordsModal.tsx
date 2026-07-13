import type { Identity } from '../types'

function passwordForPlatform(platform: Identity['platforms'][number] | undefined): string {
  return platform?.accessMethods?.find((method) => method?.type === 'PASSWORD')?.password ?? ''
}

interface ReusedPasswordEntry {
  identityEmail: string
  platform: Identity['platforms'][number]
  password: string
}

interface ReusedPasswordsModalProps {
  isOpen: boolean
  onClose: () => void
  entries: ReusedPasswordEntry[]
  onEditPlatform?: (platformId: string) => void
}

export function ReusedPasswordsModal({ isOpen, onClose, entries, onEditPlatform }: ReusedPasswordsModalProps) {
  if (!isOpen) return null

  // Group entries by shared password
  const groups: Map<string, ReusedPasswordEntry[]> = new Map()
  for (const entry of entries) {
    const pw = entry.password
    if (!groups.has(pw)) groups.set(pw, [])
    groups.get(pw)!.push(entry)
  }
  const groupList = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-vault-morph">
      <div className="flex max-h-[82vh] w-full max-w-2xl flex-col rounded-3xl border border-red-100 bg-white p-6 text-left shadow-[0_30px_90px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-[#1c1c1e]">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text-primary dark:text-slate-100">
              Contraseñas Reutilizadas
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              Estas contraseñas se usan en varias cuentas. Si una es comprometida, todas estarán en riesgo.
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

        {entries.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center text-center animate-in fade-in duration-300">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-text-primary">¡Sin reutilizaciones!</h3>
            <p className="max-w-[280px] text-sm text-text-tertiary mt-2">
              Todas tus contraseñas son únicas. ¡Excelente práctica de seguridad!
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 scrollbar-thin">
            {/* Summary banner */}
            <div className="rounded-2xl bg-red-50 border border-red-100 p-3 dark:bg-red-900/10 dark:border-red-900/20">
              <p className="text-xs font-semibold text-red-800 dark:text-red-400">
                {entries.length} cuenta{entries.length !== 1 ? 's' : ''} comparten {groupList.length} contraseña{groupList.length !== 1 ? 's' : ''} distinta{groupList.length !== 1 ? 's' : ''}. Genera contraseñas únicas para cada servicio.
              </p>
            </div>

            {groupList.map(([password, group], groupIdx) => (
              <div key={groupIdx} className="rounded-2xl border border-red-100 bg-red-50/40 dark:border-red-900/20 dark:bg-red-900/5 overflow-hidden">
                {/* Group header */}
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-red-100/60 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/20">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                    {group.length} cuentas comparten esta contraseña
                  </span>
                  <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
                    ×{group.length}
                  </span>
                </div>

                {/* Accounts in group */}
                <div className="divide-y divide-red-100/60 dark:divide-red-900/20">
                  {group.map((entry) => (
                    <div key={`${entry.identityEmail}-${entry.platform.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-red-950 dark:text-red-200">{entry.platform.name}</p>
                        <p className="truncate text-[11px] text-red-700 dark:text-red-400">{entry.identityEmail}</p>
                      </div>
                      {onEditPlatform && (
                        <button
                          type="button"
                          onClick={() => {
                            onEditPlatform(entry.platform.id)
                            onClose()
                          }}
                          className="shrink-0 flex items-center gap-1 rounded-lg border border-black/5 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.112l-2.83.849a.5.5 0 01-.632-.632l.849-2.83a4.5 4.5 0 011.112-1.89l13.43-13.43z" />
                          </svg>
                          Cambiar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

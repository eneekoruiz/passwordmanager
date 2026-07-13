import type { Identity } from '../types'

interface OldPasswordEntry {
  identityEmail: string
  platform: Identity['platforms'][number]
  daysSinceChange: number
}

interface OldPasswordsModalProps {
  isOpen: boolean
  onClose: () => void
  entries: OldPasswordEntry[]
  onEditPlatform?: (platformId: string) => void
}

function getDaysLabel(days: number): { label: string; color: string } {
  if (days >= 365) return { label: `+${Math.floor(days / 365)}a`, color: 'text-red-600 dark:text-red-400' }
  if (days >= 180) return { label: `${Math.floor(days / 30)}m`, color: 'text-orange-600 dark:text-orange-400' }
  return { label: `${Math.floor(days)}d`, color: 'text-blue-600 dark:text-blue-400' }
}

export function OldPasswordsModal({
  isOpen,
  onClose,
  entries,
  onEditPlatform,
}: OldPasswordsModalProps) {
  if (!isOpen) return null

  const sorted = [...entries].sort((a, b) => b.daysSinceChange - a.daysSinceChange)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-vault-morph">
      <div className="flex max-h-[82vh] w-full max-w-2xl flex-col rounded-3xl border border-blue-100 bg-white p-6 text-left shadow-[0_30px_90px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-[#1c1c1e]">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text-primary dark:text-slate-100">
              Contraseñas Antiguas
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              Contraseñas sin cambiar en 90+ días. Renovarlas regularmente mejora tu seguridad.
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
            <h3 className="text-lg font-bold text-text-primary">Todo al día</h3>
            <p className="max-w-[280px] text-sm text-text-tertiary mt-2">
              Ninguna de tus contraseñas lleva más de 90 días sin actualizarse.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
            {/* Summary banner */}
            <div className="rounded-2xl bg-blue-50 border border-blue-100 p-3 dark:bg-blue-900/10 dark:border-blue-900/20">
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-400">
                {sorted.length} contraseña{sorted.length !== 1 ? 's' : ''} sin actualizar en 90+ días. Se recomienda cambiarlas periódicamente.
              </p>
            </div>

            {sorted.map((entry) => {
              const { label, color } = getDaysLabel(entry.daysSinceChange)

              return (
                <div
                  key={`${entry.identityEmail}-${entry.platform.id}`}
                  className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 dark:border-blue-900/20 dark:bg-blue-900/5"
                >
                  <div className="flex items-center gap-3">
                    {/* Days badge */}
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-white shadow-sm border border-blue-100 dark:bg-slate-800 dark:border-blue-900/30">
                      <span className={`text-sm font-black leading-none ${color}`}>{label}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                        {entry.daysSinceChange >= 365 ? 'años' : entry.daysSinceChange >= 30 ? 'meses' : 'días'}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-blue-950 dark:text-blue-200">{entry.platform.name}</p>
                      <p className="truncate text-[11px] text-blue-700 dark:text-blue-400">{entry.identityEmail}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Sin cambios hace {Math.floor(entry.daysSinceChange)} días
                      </p>
                    </div>

                    {/* Actions */}
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
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

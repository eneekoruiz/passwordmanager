import type { Identity } from '../types'

interface OldPasswordEntry {
  identityEmail: string
  platform: Identity['platforms'][number]
  daysSinceChange?: number
}

interface OldPasswordsModalProps {
  isOpen: boolean
  onClose: () => void
  entries: OldPasswordEntry[]
  onEditPlatform?: (platformId: string) => void
}

export function OldPasswordsModal({
  isOpen,
  onClose,
  entries,
  onEditPlatform,
}: OldPasswordsModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-vault-morph">
      <div className="flex max-h-[82vh] w-full max-w-2xl flex-col rounded-3xl border border-amber-200/50 bg-white p-6 text-left shadow-[0_30px_90px_rgba(15,23,42,0.22)] dark:border-amber-500/20 dark:bg-[#1c1c1e]">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
              <h2 className="text-lg font-bold tracking-tight text-text-primary dark:text-slate-100">
                Contraseñas sin Verificar
              </h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              Cuentas que aún no se han comprobado o han sido modificadas recientemente.
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
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-text-primary dark:text-slate-100">Todas las contraseñas verificadas</h3>
            <p className="max-w-[280px] text-sm text-text-tertiary mt-2">
              Todas las cuentas en tu bóveda han sido marcadas como comprobadas y funcionales.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
            {/* Summary banner */}
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 dark:bg-amber-950/20 dark:border-amber-500/30">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                {entries.length} cuenta{entries.length !== 1 ? 's' : ''} pendiente{entries.length !== 1 ? 's' : ''} de verificación. Comprueba que tus accesos sigan funcionando.
              </p>
            </div>

            {entries.map((entry) => {
              const platform = entry.platform
              const hasVerified = Boolean(platform.lastVerifiedDate || platform.lastVerifiedAt)
              const statusText = !hasVerified
                ? 'Pendiente de verificar'
                : 'Modificada tras verificación'

              return (
                <div
                  key={`${entry.identityEmail}-${entry.platform.id}`}
                  className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.03] p-4 transition-all hover:border-amber-500/30 dark:border-amber-500/20 dark:bg-amber-950/10"
                >
                  <div className="flex items-center gap-3">
                    {/* Status badge icon */}
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{entry.platform.name}</p>
                        <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          {statusText}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{entry.identityEmail}</p>
                      {platform.lastVerifiedDate || platform.lastVerifiedAt ? (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Última verificación: {new Date(platform.lastVerifiedDate || platform.lastVerifiedAt || '').toLocaleDateString()}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Nunca verificada
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {onEditPlatform && (
                      <button
                        type="button"
                        onClick={() => {
                          onEditPlatform(entry.platform.id)
                          onClose()
                        }}
                        className="shrink-0 flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-[11px] font-semibold text-amber-800 transition-all hover:bg-amber-500/20 dark:bg-amber-400/15 dark:text-amber-300 dark:hover:bg-amber-400/25"
                      >
                        <span>Verificar</span>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
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

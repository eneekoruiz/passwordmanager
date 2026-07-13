interface SecurityReviewHubProps {
  isOpen: boolean
  onClose: () => void
  exposedCount: number
  reusedCount: number
  weakCount: number
  oldCount: number
  onOpenExposed: () => void
  onOpenReused: () => void
  onOpenWeak: () => void
  onOpenOld: () => void
  healthScore: number
}

interface AuditRowProps {
  icon: React.ReactNode
  label: string
  description: string
  count: number
  countColor: string
  badgeBg: string
  badgeText: string
  onClick: () => void
}

function AuditRow({ icon, label, description, count, countColor, badgeBg, badgeText, onClick }: AuditRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-2xl border border-black/[0.06] bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] dark:border-white/10 dark:bg-slate-800/60 dark:hover:bg-slate-800"
    >
      {/* Icon */}
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${badgeBg}`}>
        {icon}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-text-primary dark:text-slate-100">{label}</p>
        <p className="text-[11px] text-text-tertiary dark:text-slate-400 leading-snug mt-0.5">{description}</p>
      </div>

      {/* Count + arrow */}
      <div className="flex shrink-0 items-center gap-2">
        <span className={`text-2xl font-black ${countColor}`}>{count}</span>
        <svg className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}

export function SecurityReviewHub({
  isOpen,
  onClose,
  exposedCount,
  reusedCount,
  weakCount,
  oldCount,
  onOpenExposed,
  onOpenReused,
  onOpenWeak,
  onOpenOld,
  healthScore,
}: SecurityReviewHubProps) {
  if (!isOpen) return null

  const totalIssues = exposedCount + reusedCount + weakCount + oldCount
  const scoreColor =
    healthScore >= 85 ? 'text-emerald-600 dark:text-emerald-400' :
    healthScore >= 60 ? 'text-amber-500 dark:text-amber-400' :
    'text-red-600 dark:text-red-400'

  const scoreRingColor =
    healthScore >= 85 ? 'stroke-emerald-500' :
    healthScore >= 60 ? 'stroke-amber-400' :
    'stroke-red-500'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-vault-morph">
      <div className="flex max-h-[82vh] w-full max-w-md flex-col rounded-3xl border border-black/[0.06] bg-surface p-6 text-left shadow-[0_30px_90px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-[#1c1c1e] overflow-hidden">

        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text-primary dark:text-slate-100">
              Revisión de Seguridad
            </h2>
            <p className="mt-1 text-xs text-text-secondary dark:text-slate-400">
              {totalIssues === 0
                ? '¡Tu bóveda está en perfecto estado!'
                : `${totalIssues} problema${totalIssues !== 1 ? 's' : ''} detectado${totalIssues !== 1 ? 's' : ''} en tu bóveda.`}
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

        {/* Score ring */}
        <div className="mb-5 flex items-center gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
            <svg className="-rotate-90 h-16 w-16" viewBox="0 0 36 36">
              <path
                className="stroke-slate-200 dark:stroke-slate-700"
                strokeWidth="3"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={scoreRingColor}
                strokeWidth="3"
                fill="none"
                strokeDasharray={`${healthScore}, 100`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className={`absolute text-lg font-black ${scoreColor}`}>{healthScore}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-text-primary dark:text-slate-100">Puntuación de Salud</p>
            <p className="text-xs text-text-secondary dark:text-slate-400 mt-0.5 leading-snug">
              {healthScore >= 85
                ? 'Excelente. Tu bóveda está bien protegida.'
                : healthScore >= 60
                ? 'Hay margen de mejora. Revisa los problemas detectados.'
                : 'Atención requerida. Corrige los problemas cuanto antes.'}
            </p>
          </div>
        </div>

        {/* Audit rows */}
        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin pr-0.5">
          <AuditRow
            icon={
              <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            }
            label="Contraseñas Expuestas"
            description="Aparecen en filtraciones de datos conocidas."
            count={exposedCount}
            countColor="text-rose-600 dark:text-rose-400"
            badgeBg="bg-rose-50 dark:bg-rose-900/30"
            badgeText="text-rose-600"
            onClick={() => { onClose(); onOpenExposed() }}
          />

          <AuditRow
            icon={
              <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            }
            label="Contraseñas Reutilizadas"
            description="La misma clave usada en varias cuentas."
            count={reusedCount}
            countColor="text-red-600 dark:text-red-400"
            badgeBg="bg-red-50 dark:bg-red-900/30"
            badgeText="text-red-600"
            onClick={() => { onClose(); onOpenReused() }}
          />

          <AuditRow
            icon={
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            }
            label="Contraseñas Débiles"
            description="No cumplen los criterios mínimos de seguridad."
            count={weakCount}
            countColor="text-amber-500 dark:text-amber-400"
            badgeBg="bg-amber-50 dark:bg-amber-900/30"
            badgeText="text-amber-600"
            onClick={() => { onClose(); onOpenWeak() }}
          />

          <AuditRow
            icon={
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            label="Contraseñas Antiguas"
            description="Sin cambiar en más de 90 días."
            count={oldCount}
            countColor="text-blue-600 dark:text-blue-400"
            badgeBg="bg-blue-50 dark:bg-blue-900/30"
            badgeText="text-blue-600"
            onClick={() => { onClose(); onOpenOld() }}
          />
        </div>
      </div>
    </div>
  )
}

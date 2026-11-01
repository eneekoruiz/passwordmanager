import { useState, useMemo, useEffect } from 'react'
import type { Identity, Platform } from '../types'
import { useVault } from '../context/VaultContext'
import { useToast } from './ui/ToastProvider'
import { PlatformLogo } from './ui/PlatformLogo'
import { formatRelativeTime } from '../utils/time'
import { isAccountUnverified, isOrphanAccount } from '../utils/security'
import { getPlatformUrl } from '../utils/platformUtils'

interface AutopilotModalProps {
  isOpen: boolean
  onClose: () => void
  onEditPlatform?: (platform: Platform, identityId?: string, identityEmail?: string) => void
}

type AutopilotTab = 'summary' | 'auto_verified' | 'manual_required' | 'orphans'

export function AutopilotModal({ isOpen, onClose, onEditPlatform }: AutopilotModalProps) {
  const { identities, runAutopilot, injectOrphanAuditPlatforms } = useVault()
  const { showToast } = useToast()

  const [activeTab, setActiveTab] = useState<AutopilotTab>('summary')
  const [isRunningAutopilot, setIsRunningAutopilot] = useState(false)
  const [isInjectingOrphans, setIsInjectingOrphans] = useState(false)

  // Compute platform categories across all identities
  const { autoVerifiedList, manualRequiredList, orphanList, allPlatformsList } = useMemo(() => {
    const auto: Array<{ identity: Identity; platform: Platform }> = []
    const manual: Array<{ identity: Identity; platform: Platform }> = []
    const orphans: Array<{ identity: Identity; platform: Platform }> = []
    const all: Array<{ identity: Identity; platform: Platform }> = []

    for (const identity of identities) {
      for (const platform of identity.platforms) {
        all.push({ identity, platform })
        if (platform.autoVerified) {
          auto.push({ identity, platform })
        }
        if (platform.requiresManualVerification && isAccountUnverified(platform)) {
          manual.push({ identity, platform })
        }
        if (isOrphanAccount(platform)) {
          orphans.push({ identity, platform })
        }
      }
    }

    return {
      autoVerifiedList: auto,
      manualRequiredList: manual,
      orphanList: orphans,
      allPlatformsList: all,
    }
  }, [identities])

  if (!isOpen) return null

  const handleRunAutopilot = async () => {
    setIsRunningAutopilot(true)
    try {
      const result = await runAutopilot()
      showToast(
        `Autopilot finalizado: ${result.autoVerifiedCount} verificadas, ${result.manualRequiredCount} requieren atención manual.`,
        'success'
      )
    } catch (err: any) {
      showToast(err?.message || 'Error al ejecutar Autopilot.', 'error')
    } finally {
      setIsRunningAutopilot(false)
    }
  }

  const handleInjectOrphans = async () => {
    setIsInjectingOrphans(true)
    try {
      const result = await injectOrphanAuditPlatforms()
      showToast(
        `Se han sincronizado ${result.injectedCount} plataformas huérfanas en tu bóveda.`,
        'success'
      )
      setActiveTab('orphans')
    } catch (err: any) {
      showToast(err?.message || 'Error al sincronizar plataformas.', 'error')
    } finally {
      setIsInjectingOrphans(false)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-md animate-vault-morph cursor-pointer">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-3xl border border-border-subtle bg-white p-6 text-left shadow-2xl dark:border-white/10 dark:bg-[#1c1c1e] cursor-default">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-border-subtle dark:border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)] animate-pulse" />
              <h2 className="text-xl font-black tracking-tight text-text-primary dark:text-white">
                Autopilot: Verificación y Auditoría de Cuentas
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                ⚡ Auto-run activo al entrar
              </span>
            </div>
            <p className="mt-1 text-xs text-text-secondary leading-relaxed max-w-xl">
              Motor inteligente de confirmación desatendida. Se ejecuta automáticamente cada vez que accedes a la aplicación, validando accesos y reteniendo advertencias solo ante intervención humana (2FA, CAPTCHA) o falta de contraseña.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            aria-label="Cerrar modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action Controls & Metric Badges */}
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center dark:bg-emerald-950/20">
            <span className="block text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {autoVerifiedList.length}
            </span>
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
              Auto-confirmadas
            </span>
          </div>

          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-center dark:bg-rose-950/20">
            <span className="block text-2xl font-black text-rose-600 dark:text-rose-400">
              {manualRequiredList.length}
            </span>
            <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300">
              Requieren manual (2FA)
            </span>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-center dark:bg-amber-950/20">
            <span className="block text-2xl font-black text-amber-600 dark:text-amber-400">
              {orphanList.length}
            </span>
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
              Falta contraseña
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-white/10 dark:bg-slate-800/40">
            <span className="block text-2xl font-black text-text-primary dark:text-white">
              {allPlatformsList.length}
            </span>
            <span className="text-[11px] font-bold text-text-secondary">
              Total en bóveda
            </span>
          </div>
        </div>

        {/* Primary Action Buttons Bar */}
        <div className="mb-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={isRunningAutopilot}
            onClick={handleRunAutopilot}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-emerald-500 active:scale-95 disabled:opacity-50"
          >
            {isRunningAutopilot ? (
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Escaneando plataformas...
              </span>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
                <span>Ejecutar Autopilot de Verificación</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isInjectingOrphans}
            onClick={handleInjectOrphans}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/15 px-4 py-2.5 text-xs font-bold text-amber-800 dark:text-amber-300 transition-all hover:bg-amber-500/25 active:scale-95 disabled:opacity-50"
          >
            {isInjectingOrphans ? (
              <span>Sincronizando MCP...</span>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Sincronizar 24 Plataformas Auditadas (MCP)</span>
              </>
            )}
          </button>
        </div>

        {/* Tab selection */}
        <div className="mb-3 flex border-b border-border-subtle dark:border-white/10 gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`pb-2.5 px-3 transition-colors border-b-2 ${
              activeTab === 'summary'
                ? 'border-text-primary text-text-primary dark:border-white dark:text-white'
                : 'border-transparent text-text-tertiary hover:text-text-primary'
            }`}
          >
            Resumen General
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('auto_verified')}
            className={`pb-2.5 px-3 transition-colors border-b-2 ${
              activeTab === 'auto_verified'
                ? 'border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-text-tertiary hover:text-emerald-500'
            }`}
          >
            Auto-confirmadas ({autoVerifiedList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual_required')}
            className={`pb-2.5 px-3 transition-colors border-b-2 ${
              activeTab === 'manual_required'
                ? 'border-rose-500 text-rose-600 dark:border-rose-400 dark:text-rose-400'
                : 'border-transparent text-text-tertiary hover:text-rose-500'
            }`}
          >
            Atención Manual ({manualRequiredList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orphans')}
            className={`pb-2.5 px-3 transition-colors border-b-2 ${
              activeTab === 'orphans'
                ? 'border-amber-500 text-amber-600 dark:border-amber-400 dark:text-amber-400'
                : 'border-transparent text-text-tertiary hover:text-amber-500'
            }`}
          >
            Falta Contraseña ({orphanList.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin space-y-2.5">
          {activeTab === 'summary' && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4 border border-black/5 dark:bg-white/[0.03] dark:border-white/10">
                <h3 className="text-xs font-black uppercase tracking-wider text-text-tertiary">
                  Estado del Motor de Confirmación
                </h3>
                <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                  Autopilot inspecciona cada cuenta registrada. Si la plataforma permite validación desatendida mediante tokens o sesión sin desafíos interactivos, la confirma automáticamente etiquetando el registro con la hora exacta (ej. "hace 1 minuto"). Si detecta un paso de verificación humana física (2FA, CAPTCHA o Hardware Key), cancela la operación de forma segura y preserva la alerta visual.
                </p>
              </div>

              {autoVerifiedList.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                    Últimas confirmaciones automáticas exitosas
                  </h4>
                  <div className="space-y-2">
                    {autoVerifiedList.slice(0, 3).map(({ identity, platform }) => (
                      <div
                        key={`${identity.id}-${platform.id}`}
                        className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/20"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <PlatformLogo name={platform.name} className="h-8 w-8 rounded-lg" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-text-primary dark:text-white truncate">
                              {platform.name}
                            </p>
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                              ✓ Confirmado automáticamente {formatRelativeTime(platform.autoVerifiedAt || platform.lastVerifiedAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'auto_verified' && (
            autoVerifiedList.length === 0 ? (
              <div className="flex h-44 flex-col items-center justify-center text-center text-text-tertiary">
                <p className="text-sm font-semibold">Aún no hay cuentas auto-confirmadas</p>
                <p className="text-xs mt-1">Presiona "Ejecutar Autopilot" para iniciar el escaneo desatendido.</p>
              </div>
            ) : (
              autoVerifiedList.map(({ identity, platform }) => (
                <div
                  key={`${identity.id}-${platform.id}`}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] transition-all hover:border-emerald-500/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PlatformLogo name={platform.name} className="h-10 w-10 rounded-xl" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-text-primary dark:text-white truncate">
                          {platform.name}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          ✓ Auto-confirmado {formatRelativeTime(platform.autoVerifiedAt || platform.lastVerifiedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary truncate mt-0.5">
                        {platform.username || identity.email}
                      </p>
                      <p className="text-[10px] text-text-tertiary mt-0.5 italic">
                        {platform.autoVerificationLog || 'Verificación desatendida completada con éxito.'}
                      </p>
                    </div>
                  </div>
                  {onEditPlatform && (
                    <button
                      type="button"
                      onClick={() => {
                        onEditPlatform(platform, identity.id, identity.email)
                        onClose()
                      }}
                      className="ml-2 shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-text-primary transition-all"
                    >
                      Ver
                    </button>
                  )}
                </div>
              ))
            )
          )}

          {activeTab === 'manual_required' && (
            manualRequiredList.length === 0 ? (
              <div className="flex h-44 flex-col items-center justify-center text-center text-text-tertiary">
                <p className="text-sm font-semibold">No hay cuentas bloqueadas por verificación manual</p>
                <p className="text-xs mt-1">Todas las plataformas compatibles han sido procesadas.</p>
              </div>
            ) : (
              manualRequiredList.map(({ identity, platform }) => (
                <div
                  key={`${identity.id}-${platform.id}`}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-rose-500/25 bg-rose-500/[0.04] transition-all hover:border-rose-500/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PlatformLogo name={platform.name} className="h-10 w-10 rounded-xl" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-text-primary dark:text-white truncate">
                          {platform.name}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                          ⚠️ {platform.manualVerificationReason || 'Atención requerida'}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary truncate mt-0.5">
                        {platform.username || identity.email}
                      </p>
                      <p className="text-[10px] text-text-tertiary mt-0.5">
                        {platform.autoVerificationLog || 'Requiere validación humana obligatoria.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const url = getPlatformUrl(platform.name)
                        if (url) window.open(url, '_blank', 'noopener,noreferrer')
                      }}
                      className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition-all"
                    >
                      Abrir Web
                    </button>
                    {onEditPlatform && (
                      <button
                        type="button"
                        onClick={() => {
                          onEditPlatform(platform, identity.id, identity.email)
                          onClose()
                        }}
                        className="rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-text-primary transition-all"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                </div>
              ))
            )
          )}

          {activeTab === 'orphans' && (
            orphanList.length === 0 ? (
              <div className="flex h-44 flex-col items-center justify-center text-center text-text-tertiary">
                <p className="text-sm font-semibold">No hay cuentas huérfanas sin contraseña</p>
                <p className="text-xs mt-1">Presiona "Sincronizar 24 Plataformas Auditadas" para inyectarlas desde el catálogo.</p>
              </div>
            ) : (
              orphanList.map(({ identity, platform }) => (
                <div
                  key={`${identity.id}-${platform.id}`}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] transition-all hover:border-amber-500/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PlatformLogo name={platform.name} className="h-10 w-10 rounded-xl" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-text-primary dark:text-white truncate">
                          {platform.name}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider">
                          ⚠️ FALTA CONTRASEÑA
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary truncate mt-0.5">
                        {platform.notes || `Identidad: ${identity.email}`}
                      </p>
                    </div>
                  </div>
                  {onEditPlatform && (
                    <button
                      type="button"
                      onClick={() => {
                        onEditPlatform(platform, identity.id, identity.email)
                        onClose()
                      }}
                      className="ml-2 shrink-0 rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-1.5 text-xs font-bold shadow-sm transition-all hover:scale-105 active:scale-95"
                    >
                      + Añadir Contraseña
                    </button>
                  )}
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  )
}

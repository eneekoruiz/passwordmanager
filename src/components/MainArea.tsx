import { useEffect, useMemo, useState, memo } from 'react'
import type { Identity, LocalCategory, LocalVaultItem, Platform, VaultGroupMode, SortMode } from '../types'
import { createPlatform } from '../utils/identity'
import { createLocalVaultItem, LOCAL_ITEM_LABELS, vaultItemDisplayName } from '../utils/vaultItem'
import { hasWeakPassword } from '../utils/security'
import { AccountForm, type UnsavedFormActions } from './AccountForm'
import { EmptyState } from './EmptyState'
import { PlatformLogo } from './ui/PlatformLogo'
import { VaultItemForm } from './VaultItemForm'
import { getCanonicalPlatformName } from '../utils/platformUtils'
import { WeakPasswordWarningPopover } from './ui/WeakPasswordWarningPopover'
import { ShareModal, type SharePayload } from './ShareModal'
type ViewMode = 'grid' | 'create' | 'edit'

const getPlatformUrl = (name: string): string => {
  const cleanName = name.trim().toLowerCase()
  if (cleanName.startsWith('http://') || cleanName.startsWith('https://')) {
    return cleanName
  }
  if (cleanName.includes('.')) {
    return `https://${cleanName}`
  }
  return `https://${cleanName}.com`
}

interface MainAreaProps {
  identities: Identity[]
  identity: Identity | null
  groupMode: VaultGroupMode
  selectedPlatformName: string | null
  localCategory: LocalCategory | null
  localItems: LocalVaultItem[]
  onOpenSidebar: () => void
  onRequestNavigation: (action: () => void) => void
  onUnsavedStateChange: (dirty: boolean, actions: UnsavedFormActions | null) => void
  onSelectIdentity: (id: string | null) => void
  onSelectPlatformName: (platformName: string | null) => void
  onSelectLocalCategory: (category: LocalCategory | null) => void
  onOpenImportText: () => void
  onCreate: () => void
  onAddPlatform: (identityId: string, platform: Platform) => Promise<void>
  onUpdatePlatform: (identityId: string, platformId: string, platform: Platform) => Promise<void>
  onDeletePlatform: (identityId: string, platformId: string) => Promise<void>
  onSaveLocalItem: (item: LocalVaultItem) => Promise<void>
  onDeleteLocalItem: (itemId: string) => Promise<void>
  isMobile?: boolean
  createTrigger?: number
  editPlatformTrigger?: string | null
  onEditPlatformHandled?: () => void
  sortMode: SortMode
  searchQuery?: string
  syncing?: boolean
}

interface PlatformAccount {
  identityId: string
  identityEmail: string
  platform: Platform
}

interface EditingPlatformContext {
  identityId: string
  identityEmail: string
  platform: Platform
}

interface PlatformQuickPick {
  name: string
  count: number
  hasWeakPassword: boolean
  maxAccessDate: string
}


export const MainArea = memo(function MainArea({
  identities,
  identity,
  groupMode,
  selectedPlatformName,
  localCategory,
  localItems,
  onOpenSidebar,
  onRequestNavigation,
  onUnsavedStateChange,
  onSelectIdentity,
  onSelectPlatformName,
  onSelectLocalCategory,
  onOpenImportText,
  onCreate,
  onAddPlatform,
  onUpdatePlatform,
  onDeletePlatform,
  onSaveLocalItem,
  onDeleteLocalItem,
  isMobile = false,
  createTrigger = 0,
  editPlatformTrigger = null,
  onEditPlatformHandled,
  sortMode,
  searchQuery = '',
  syncing = false,
}: MainAreaProps) {
  const [view, setView] = useState<ViewMode>('grid')
  const [editingPlatform, setEditingPlatform] = useState<EditingPlatformContext | null>(null)
  const [editingLocalItem, setEditingLocalItem] = useState<LocalVaultItem | null>(null)
  const [showShareModal, setShowShareModal] = useState<SharePayload | null>(null)
  const [quickTravelCopied, setQuickTravelCopied] = useState<string | null>(null)
  const [hideWarnings, setHideWarnings] = useState(() => {
    return typeof window !== 'undefined' && window.localStorage.getItem('contras.hideWeakPasswordWarnings') === 'true'
  })

  useEffect(() => {
    const handleToggle = () => {
      setHideWarnings(window.localStorage.getItem('contras.hideWeakPasswordWarnings') === 'true')
    }
    window.addEventListener('contras:weak-passwords-toggled', handleToggle)
    return () => window.removeEventListener('contras:weak-passwords-toggled', handleToggle)
  }, [])

  const resetView = () => {
    setView('grid')
    setEditingPlatform(null)
    setEditingLocalItem(null)
  }

  const activeContextKey = `${groupMode}:${identity?.id ?? ''}:${selectedPlatformName ?? ''}:${localCategory?.id ?? ''}`

  useEffect(() => {
    resetView()
  }, [activeContextKey])

  useEffect(() => {
    if (createTrigger > 0) {
      const targetIdentity = identity || (identities.length > 0 ? identities[0] : null)
      if (localCategory) {
        setEditingLocalItem(createLocalVaultItem(localCategory.type, localCategory.id, localCategory.label))
        setView('create')
      } else if (targetIdentity) {
        setEditingPlatform({
          identityId: targetIdentity.id,
          identityEmail: targetIdentity.email,
          platform: createPlatform('', { username: '' }),
        })
        setView('create')
      }
    }
  }, [createTrigger])

  useEffect(() => {
    if (editPlatformTrigger) {
      const list = identities.flatMap((item) =>
        (item?.platforms || []).map((platform) => ({
          identityId: item.id,
          identityEmail: item.email,
          platform,
        })),
      )
      const target = list.find((t) => t.platform.id === editPlatformTrigger)
      if (target) {
        setEditingPlatform(target)
        setView('edit')
        onEditPlatformHandled?.()
      }
    }
  }, [editPlatformTrigger, identities, onEditPlatformHandled])

  const platformAccounts = useMemo<PlatformAccount[]>(() => {
    if (groupMode !== 'platform' || !selectedPlatformName) return []
    const target = selectedPlatformName.trim().toLowerCase()
    const list = identities.flatMap((item) =>
      (item?.platforms || [])
        .filter((platform) => platform?.name?.trim().toLowerCase() === target)
        .map((platform) => ({
          identityId: item.id,
          identityEmail: item.email,
          platform,
        })),
    )

    return list.sort((a, b) => {
      if (sortMode === 'alpha-asc') {
        return a.identityEmail.localeCompare(b.identityEmail) || (a.platform.username || '').localeCompare(b.platform.username || '')
      } else if (sortMode === 'alpha-desc') {
        return b.identityEmail.localeCompare(a.identityEmail) || (b.platform.username || '').localeCompare(a.platform.username || '')
      } else if (sortMode === 'created-desc') {
        const dateA = a.platform.createdAt ? new Date(a.platform.createdAt).getTime() : 0
        const dateB = b.platform.createdAt ? new Date(b.platform.createdAt).getTime() : 0
        return dateB - dateA
      } else if (sortMode === 'created-asc') {
        const dateA = a.platform.createdAt ? new Date(a.platform.createdAt).getTime() : 0
        const dateB = b.platform.createdAt ? new Date(b.platform.createdAt).getTime() : 0
        return dateA - dateB
      } else if (sortMode === 'access-desc') {
        const dateA = a.platform.lastAccessedAt ? new Date(a.platform.lastAccessedAt).getTime() : 0
        const dateB = b.platform.lastAccessedAt ? new Date(b.platform.lastAccessedAt).getTime() : 0
        return dateB - dateA
      } else if (sortMode === 'usage-desc') {
        return (b.platform.accessCount || 0) - (a.platform.accessCount || 0) || a.identityEmail.localeCompare(b.identityEmail)
      }
      return 0
    })
  }, [groupMode, identities, selectedPlatformName, sortMode])

  const rawDisplayName = platformAccounts[0]?.platform.name ?? selectedPlatformName ?? ''
  const selectedPlatformDisplayName = getCanonicalPlatformName(rawDisplayName)
  const hasVaultSelection = Boolean(identity || localCategory || selectedPlatformName)
  const featuredPlatforms = useMemo<PlatformQuickPick[]>(() => {
    const platformData = new Map<string, { name: string; count: number; minDate: string; maxDate: string; maxAccessDate: string; hasWeakPassword: boolean }>()
    identities.forEach((item) => {
      (item?.platforms || []).forEach((platform) => {
        const name = platform?.name?.trim()
        if (!name) return
        const key = name.toLowerCase()
        const date = platform.createdAt || new Date(0).toISOString()
        const accessDate = platform.lastAccessedAt || ''
        const existing = platformData.get(key)
        const canonicalName = getCanonicalPlatformName(name)
        if (existing) {
          existing.count += 1
          if (date < existing.minDate) existing.minDate = date
          if (date > existing.maxDate) existing.maxDate = date
          if (accessDate > existing.maxAccessDate) existing.maxAccessDate = accessDate
          existing.hasWeakPassword = existing.hasWeakPassword || hasWeakPassword(platform)
        } else {
          platformData.set(key, {
            name: canonicalName,
            count: 1,
            minDate: date,
            maxDate: date,
            maxAccessDate: accessDate,
            hasWeakPassword: hasWeakPassword(platform),
          })
        }
      })
    })

    const list = Array.from(platformData.values())
    list.sort((a, b) => {
      if (sortMode === 'alpha-asc') {
        return a.name.localeCompare(b.name)
      } else if (sortMode === 'alpha-desc') {
        return b.name.localeCompare(a.name)
      } else if (sortMode === 'created-desc') {
        return b.maxDate.localeCompare(a.maxDate)
      } else if (sortMode === 'created-asc') {
        return a.minDate.localeCompare(b.minDate)
      } else if (sortMode === 'access-desc') {
        return (b.maxAccessDate || b.maxDate).localeCompare(a.maxAccessDate || a.maxDate)
      } else if (sortMode === 'usage-desc') {
        return b.count - a.count || a.name.localeCompare(b.name)
      }
      return 0
    })
    return list
  }, [identities, sortMode])

  const renderProactiveEmptyState = ({
    title = 'Aún no tienes elementos aquí',
    description,
    actionLabel,
    onAction,
  }: {
    title?: string
    description: string
    actionLabel: string
    onAction: () => void
  }) => (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-white/72 px-6 text-center shadow-[0_18px_55px_rgba(15,23,42,0.04)] animate-vault-morph">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-text-secondary shadow-sm ring-1 ring-black/5">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
        </svg>
      </div>
      <h3 className="text-base font-bold text-text-primary">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-text-primary px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:scale-105 hover:shadow-lg active:scale-[0.98]"
      >
        <span>{actionLabel}</span>
        <span aria-hidden="true">➔</span>
      </button>
    </div>
  )

  if (!hasVaultSelection) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {!isMobile && (
          <header className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 lg:hidden">
            <button
              type="button"
              onClick={onOpenSidebar}
              className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover"
              aria-label="Abrir lista de identidades"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm font-medium text-text-secondary">Contras</span>
          </header>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="flex justify-center px-6 py-6 lg:py-12 min-h-full">
            <div className="w-full max-w-5xl">
            <div className="p-1">
              <div className="grid gap-6">
                <section className="space-y-5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-black/[0.04] pb-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">
                        {groupMode === 'platform' ? 'Vista por plataforma' : groupMode === 'local' ? 'Bóveda Local' : 'Tus Identidades'}
                      </p>
                      <h2 className="mt-1 text-2xl font-black tracking-tight text-text-primary">
                        {groupMode === 'platform' ? 'Explora tus accesos con la vista visual' : groupMode === 'local' ? 'Gestiona tus notas y secretos locales' : 'Gestiona tus cuentas por identidad'}
                      </h2>
                      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-secondary">
                        {groupMode === 'platform'
                          ? 'Selecciona una plataforma para ver las cuentas, comparar accesos y editar.'
                          : groupMode === 'local'
                          ? 'Selecciona una categoría para ver tus secretos locales.'
                          : 'Selecciona una identidad para ver todas las plataformas y cuentas vinculadas.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onCreate()}
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white shadow-sm transition-transform hover:scale-[1.03] active:scale-95 self-start md:self-center"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Crear {groupMode === 'platform' ? 'cuenta' : groupMode === 'local' ? 'secreto local' : 'identidad'}
                    </button>
                  </div>
                  {isMobile && groupMode === 'platform' && (
                    <div className="mt-4 flex items-center gap-3 border-t border-black/[0.04] pt-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Plataformas</span>
                        <span className="text-sm font-semibold text-text-primary">{featuredPlatforms.length}</span>
                      </div>
                      <div className="h-6 w-px bg-black/[0.04]"></div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Cuentas</span>
                        <span className="text-sm font-semibold text-text-primary">{identities.reduce((sum, id) => sum + (id.platforms?.length || 0), 0)}</span>
                      </div>
                    </div>
                  )}

                  {groupMode === 'platform' ? (
                    featuredPlatforms.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {featuredPlatforms.map((platform, index) => (
                          <button
                            key={platform.name}
                            type="button"
                            onClick={() => onRequestNavigation(() => onSelectPlatformName(platform.name))}
                            className="animate-vault-slide-up flex items-center gap-4 rounded-2xl border border-black/[0.06] bg-white/80 p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-0.5 hover:scale-[1.02] hover:border-black/10 hover:bg-white"
                            style={{ animationDelay: `${index * 40}ms` }}
                          >
                            <PlatformLogo name={getCanonicalPlatformName(platform.name)} className="h-11 w-11 rounded-2xl border border-black/[0.05] bg-white p-1 shadow-sm" />
                            <span className="min-w-0 flex-1 relative">
                              <span className="block truncate text-sm font-semibold text-text-primary pr-5">{getCanonicalPlatformName(platform.name)}</span>
                              {(!hideWarnings && platform.hasWeakPassword) && (
                                <div className="absolute right-0 top-0 text-amber-500" title="Al menos una cuenta tiene contraseña débil">
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              <span className="mt-1 block text-xs text-text-secondary">
                                {platform.count} cuenta{platform.count !== 1 ? 's' : ''} registradas
                              </span>
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-text-secondary">
                              Abrir
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : syncing ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 animate-pulse">
                        {Array.from({ length: 16 }, (_, i) => i).map(i => (
                          <div key={i} className="flex min-h-[76px] items-center gap-4 rounded-2xl border border-black/5 bg-white/50 p-4">
                            <div className="h-11 w-11 rounded-2xl bg-black/10"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-3.5 w-1/2 rounded bg-black/10"></div>
                              <div className="h-2.5 w-1/3 rounded bg-black/5"></div>
                            </div>
                            <div className="h-5 w-10 rounded-full bg-black/5"></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      renderProactiveEmptyState({
                        description: 'Crea uno nuevo aquí y aparecerá agrupado por plataforma cuando lo guardes.',
                        actionLabel: 'Crea uno nuevo aquí',
                        onAction: onCreate,
                      })
                    )
                  ) : groupMode === 'local' ? (
                    syncing ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 animate-pulse">
                        {Array.from({ length: 16 }, (_, i) => i).map(i => (
                          <div key={i} className="flex min-h-[76px] items-center gap-4 rounded-2xl border border-black/5 bg-white/50 p-4">
                            <div className="h-11 w-11 rounded-2xl bg-black/10"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-3.5 w-1/2 rounded bg-black/10"></div>
                              <div className="h-2.5 w-1/3 rounded bg-black/5"></div>
                            </div>
                            <div className="h-5 w-10 rounded-full bg-black/5"></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface-subtle py-12 text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
                          <svg className="h-6 w-6 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <h3 className="text-base font-bold text-text-primary">Selecciona una categoría</h3>
                        <p className="mt-1 max-w-sm text-sm text-text-secondary">Elige una categoría de la bóveda local en la barra lateral para ver o añadir secretos.</p>
                      </div>
                    )
                  ) : identities.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {identities.map((idItem, index) => (
                        <button
                          key={idItem.id}
                          type="button"
                          onClick={() => onRequestNavigation(() => onSelectIdentity(idItem.id))}
                          className="animate-vault-slide-up flex items-center gap-4 rounded-2xl border border-black/[0.06] bg-white/80 p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-0.5 hover:scale-[1.02] hover:border-black/10 hover:bg-white"
                          style={{ animationDelay: `${index * 40}ms` }}
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 font-bold text-text-primary ring-1 ring-black/5">
                            {idItem.email.charAt(0).toUpperCase()}
                          </div>
                          <span className="min-w-0 flex-1 relative">
                            <span className="block truncate text-sm font-semibold text-text-primary pr-5">{idItem.email}</span>
                            <span className="mt-1 block text-xs text-text-secondary">
                              {(idItem?.platforms || []).length} plataforma{(idItem?.platforms || []).length !== 1 ? 's' : ''} vinculada{(idItem?.platforms || []).length !== 1 ? 's' : ''}
                            </span>
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-text-secondary">
                            Abrir
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : syncing ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 animate-pulse">
                      {Array.from({ length: 16 }, (_, i) => i).map(i => (
                        <div key={i} className="flex min-h-[76px] items-center gap-4 rounded-2xl border border-black/5 bg-white/50 p-4">
                          <div className="h-11 w-11 rounded-2xl bg-black/10"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-3.5 w-1/2 rounded bg-black/10"></div>
                            <div className="h-2.5 w-1/3 rounded bg-black/5"></div>
                          </div>
                          <div className="h-5 w-10 rounded-full bg-black/5"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    renderProactiveEmptyState({
                      description: 'Crea uno nuevo aquí para empezar a guardar credenciales bajo un correo o perfil.',
                      actionLabel: 'Crea uno nuevo aquí',
                      onAction: onCreate,
                    })
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    )
  }

  const isFormView = view === 'create' || view === 'edit'
  const itemQuery = searchQuery.trim().toLowerCase()
  const selectedLocalItems = localCategory
    ? localItems.filter((item) => (item.categoryId ?? item.type) === localCategory.id)
    : []
  const filteredLocalItems = selectedLocalItems.filter((item) => {
    if (!itemQuery) return true
    return [vaultItemDisplayName(item), item.title]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(itemQuery))
  })
  const filteredPlatformAccounts = platformAccounts.filter(({ identityEmail, platform }) => {
    if (!itemQuery) return true
    return [identityEmail, platform.name, platform.username, platform.notes]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(itemQuery))
  })
  const identityPlatforms = (identity?.platforms || []).filter((platform) => {
    if (!itemQuery) return true
    return [platform.name, platform.username, platform.notes]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(itemQuery))
  })


  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!isFormView && (
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border-subtle bg-white/72 px-4 py-3 shadow-sm backdrop-blur-xl lg:px-8 lg:py-5">
        {isMobile ? (
          <button
            type="button"
            onClick={() => {
              if (localCategory) onSelectLocalCategory(null)
              else if (groupMode === 'platform') onSelectPlatformName(null)
              else onSelectIdentity(null)
            }}
            className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover"
            aria-label="Volver a identidades"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover lg:hidden"
            aria-label="Abrir lista de identidades"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        {/* Desktop Back Button */}
        {!isMobile && (
          <button
            type="button"
            onClick={() => {
              if (localCategory) onSelectLocalCategory(null)
              else if (groupMode === 'platform') onSelectPlatformName(null)
              else onSelectIdentity(null)
            }}
            className="hidden rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary lg:block"
            aria-label="Volver"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-text-primary">
            {localCategory
              ? localCategory.label
              : groupMode === 'platform'
                ? selectedPlatformDisplayName
                : identity?.email}
          </h2>
          <p className="mt-0.5 truncate text-xs text-text-tertiary">
            {localCategory
              ? `${selectedLocalItems.length} secreto${selectedLocalItems.length !== 1 ? 's' : ''}`
              : groupMode === 'platform'
                ? `${platformAccounts.length} cuenta${platformAccounts.length !== 1 ? 's' : ''} en esta plataforma`
                : `${identity?.platforms.length ?? 0} plataforma${identity?.platforms.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {identity && !localCategory && (
          <button
            type="button"
            title="Compartir identidad completa"
            onClick={() => setShowShareModal({
              type: 'bundle',
              identity: identity,
              platforms: identity.platforms || []
            })}
            className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-sm font-medium text-text-primary shadow-subtle transition-colors hover:bg-surface-hover flex items-center gap-1.5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="hidden sm:block">Compartir</span>
          </button>
        )}
        {(localCategory || identity) && (
          <button
            type="button"
            onClick={() => {
              if (localCategory) {
                setEditingLocalItem(createLocalVaultItem(localCategory.type, localCategory.id, localCategory.label))
              } else if (identity) {
                setEditingPlatform({
                  identityId: identity.id,
                  identityEmail: identity.email,
                  platform: createPlatform('', { username: '' }),
                })
              }
              setView('create')
            }}
            className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-sm font-medium text-text-primary shadow-subtle transition-colors hover:bg-surface-hover"
          >
            Añadir
          </button>
        )}
      </header>
      )}

      <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${isFormView ? '' : 'px-4 py-4 pb-24 lg:px-8 lg:py-6'}`}>
        {view === 'grid' && (
          <>

            {localCategory ? (
              filteredLocalItems.length === 0 ? (
                renderProactiveEmptyState({
                  description: `Crea uno nuevo aquí para guardar el primer secreto de ${localCategory.label}.`,
                  actionLabel: 'Crea uno nuevo aquí',
                  onAction: () => {
                    setEditingLocalItem(createLocalVaultItem(localCategory.type, localCategory.id, localCategory.label))
                    setView('create')
                  },
                })
              ) : (
                <div className="grid grid-cols-1 gap-4 pr-1 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredLocalItems.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setEditingLocalItem(item)
                        setView('edit')
                      }}
                      style={{ animationDelay: `${index * 45}ms` }}
                      className="animate-vault-slide-up relative min-h-[106px] overflow-hidden rounded-2xl border border-black/[0.06] bg-gradient-to-b from-white via-white to-slate-50/90 p-4 text-left shadow-[0_18px_55px_rgba(15,23,42,0.05)] backdrop-blur transition-all duration-150 hover:-translate-y-1 hover:scale-[1.02] hover:border-black/10 hover:shadow-[0_24px_70px_rgba(15,23,42,0.08)] active:scale-[0.98]"
                    >
                      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
                      <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
                        {LOCAL_ITEM_LABELS[item.type]}
                      </span>
                      <span className="mt-2 block truncate text-sm font-semibold text-text-primary">
                        {vaultItemDisplayName(item)}
                      </span>
                      <span className="mt-3 inline-flex rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                        Cifrado local
                      </span>
                    </button>
                  ))}
                </div>
              )
            ) : groupMode === 'platform' && selectedPlatformName ? (
              filteredPlatformAccounts.length === 0 ? (
                renderProactiveEmptyState({
                  description: `Crea uno nuevo aquí para añadir la primera cuenta de ${selectedPlatformDisplayName}.`,
                  actionLabel: 'Crea uno nuevo aquí',
                  onAction: () => {
                    const targetIdentity = identities[0]
                    if (!targetIdentity) return onCreate()
                    setEditingPlatform({
                      identityId: targetIdentity.id,
                      identityEmail: targetIdentity.email,
                      platform: createPlatform(selectedPlatformDisplayName, { username: '' }),
                    })
                    setView('create')
                  },
                })
              ) : (
                <div className="grid grid-cols-1 gap-4 pr-1 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredPlatformAccounts.map(({ identityId, identityEmail, platform }, index) => {
                    const pwMethod = (platform.accessMethods || []).find((m: any) => m?.type === 'PASSWORD') as any
                    const hasUrl = !!(platform as any).url
                    return (
                    <div key={`${identityId}-${platform.id}`} className="relative group">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPlatform({ identityId, identityEmail, platform })
                          setView('edit')
                        }}
                        style={{ animationDelay: `${index * 45}ms` }}
                        className="animate-vault-slide-up relative flex w-full min-h-[112px] items-start gap-3 rounded-2xl border border-black/[0.06] bg-gradient-to-b from-white via-white to-slate-50/90 p-4 text-left shadow-[0_18px_55px_rgba(15,23,42,0.05)] backdrop-blur transition-all duration-150 hover:-translate-y-1 hover:scale-[1.02] hover:border-black/10 hover:shadow-[0_24px_70px_rgba(15,23,42,0.08)] active:scale-[0.98]"
                      >
                        <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
                        <PlatformLogo name={getCanonicalPlatformName(platform.name)} className="h-9 w-9" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-text-primary min-h-[20px] pr-5">
                            {platform.username}
                          </span>
                          <span className="mt-1 block truncate text-xs text-text-secondary">
                            {identityEmail}
                          </span>
                          <span className="mt-3 flex flex-wrap gap-1.5">
                            {(platform?.accessMethods || [])
                              .filter((method) => method?.type === 'SSO')
                              .map((method) => {
                                const providers = Array.isArray(method?.providers)
                                  ? method.providers
                                  : (typeof method?.providers === 'string' ? [method.providers] : [])
                                return (
                                  <span key={method?.id} className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                                    {providers.join(', ')}
                                  </span>
                                )
                              })}
                            {(platform?.accessMethods || []).some((method) => method?.type === 'PASSKEY') && (
                              <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                                Passkey
                              </span>
                            )}
                            {platform?.twoFactorAuth && (
                              <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                                2FA
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                      {(!hideWarnings && hasWeakPassword(platform)) && (
                        <WeakPasswordWarningPopover
                          className="absolute right-3 top-3 z-20"
                          onIgnore={() => void onUpdatePlatform(identityId, platform.id, { ...platform, ignoreWeakPasswordWarning: true })}
                          onDisableGlobally={() => {
                            window.localStorage.setItem('contras.hideWeakPasswordWarnings', 'true')
                            window.dispatchEvent(new Event('contras:weak-passwords-toggled'))
                            window.dispatchEvent(new Event('contras:open-settings'))
                          }}
                        />
                      )}
                      {/* Quick Travel Button */}
                      {(pwMethod?.password || hasUrl) && (
                        <div className="absolute bottom-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          {pwMethod?.password && (
                            <>
                              <button
                                type="button"
                                title="Copiar contraseña"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  try {
                                    await navigator.clipboard.writeText(pwMethod.password)
                                    setQuickTravelCopied(`${identityId}-${platform.id}-pw`)
                                    setTimeout(() => setQuickTravelCopied(null), 2000)
                                  } catch {}
                                }}
                                className={`p-1.5 rounded-lg text-xs font-bold shadow-sm border transition-all ${
                                  quickTravelCopied === `${identityId}-${platform.id}-pw`
                                    ? 'bg-green-500 text-white border-green-400'
                                    : 'bg-white/95 text-text-secondary border-black/10 hover:text-indigo-600'
                                }`}
                              >
                                {quickTravelCopied === `${identityId}-${platform.id}-pw` ? (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                )}
                              </button>
                              <button
                                type="button"
                                title="Viaje Rápido (Copiar y abrir)"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  try {
                                    await navigator.clipboard.writeText(pwMethod.password)
                                    setQuickTravelCopied(`${identityId}-${platform.id}-travel`)
                                    setTimeout(() => setQuickTravelCopied(null), 2000)
                                    window.open(getPlatformUrl(platform.name), '_blank')
                                  } catch {}
                                }}
                                className={`p-1.5 rounded-lg text-xs font-bold shadow-sm border transition-all ${
                                  quickTravelCopied === `${identityId}-${platform.id}-travel`
                                    ? 'bg-green-500 text-white border-green-400'
                                    : 'bg-white/95 text-text-secondary border-black/10 hover:text-indigo-600'
                                }`}
                              >
                                {quickTravelCopied === `${identityId}-${platform.id}-travel` ? (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
              )
            ) : identity && identityPlatforms.length === 0 && !itemQuery ? (
              <EmptyState
                onAddPassword={() => {
                  setEditingPlatform({
                    identityId: identity.id,
                    identityEmail: identity.email,
                    platform: createPlatform('', { username: '' }),
                  })
                  setView('create')
                }}
                onImportText={onOpenImportText}
              />
            ) : (
                <div className="grid grid-cols-1 gap-4 pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {identityPlatforms.map((platform, index) => {
                  const pwMethod = (platform.accessMethods || []).find((m: any) => m?.type === 'PASSWORD') as any
                  return (
                  <div key={platform.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlatform({
                          identityId: identity?.id ?? '',
                          identityEmail: identity?.email ?? '',
                          platform,
                        })
                        setView('edit')
                      }}
                      style={{ animationDelay: `${index * 45}ms` }}
                      className="animate-vault-slide-up relative flex w-full min-h-[112px] items-start gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-gradient-to-b from-white via-white to-slate-50/90 p-4 text-left shadow-[0_18px_55px_rgba(15,23,42,0.05)] backdrop-blur transition-all duration-150 hover:-translate-y-1 hover:scale-[1.02] hover:border-black/10 hover:shadow-[0_24px_70px_rgba(15,23,42,0.08)] active:scale-[0.98]"
                    >
                    <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
                    <PlatformLogo name={platform.name} className="h-9 w-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text-primary pr-5">
                        {platform.name}
                      </span>
                      <span className="mt-1 block truncate text-xs text-text-secondary">
                        {(platform.username || identity?.email) ?? ''}
                      </span>
                      <span className="mt-3 flex flex-wrap gap-1.5">
                        {(platform?.accessMethods || [])
                          .filter((method) => method?.type === 'SSO')
                          .map((method) => {
                            const providers = Array.isArray(method?.providers)
                              ? method.providers
                              : (typeof method?.providers === 'string' ? [method.providers] : [])
                            return (
                              <span key={method?.id} className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                                {providers.join(', ')}
                              </span>
                            )
                          })}
                        {(platform?.accessMethods || []).some((method) => method?.type === 'PASSKEY') && (
                          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                            Passkey
                          </span>
                        )}
                        {(platform?.accessMethods || []).some((method) => method?.type === 'MAGIC_LINK') && (
                          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                            Magic link
                          </span>
                        )}
                        {platform.hardwareKey && (
                          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                            YubiKey
                          </span>
                        )}
                        {platform.twoFactorAuth && (
                          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                            2FA
                          </span>
                        )}
                        {platform.linkedPhone && (
                          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                            Teléfono
                          </span>
                        )}
                        {platform.recoveryCodes && (
                          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                            Recovery
                          </span>
                        )}
                        {platform.apiKeys?.length ? (
                          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                            {platform.apiKeys.length} API
                          </span>
                        ) : null}
                      </span>
                    </span>
                    </button>
                    {(!hideWarnings && hasWeakPassword(platform)) && identity && (
                      <WeakPasswordWarningPopover
                        className="absolute right-3 top-3 z-20"
                        onIgnore={() => void onUpdatePlatform(identity.id, platform.id, { ...platform, ignoreWeakPasswordWarning: true })}
                        onDisableGlobally={() => {
                          window.localStorage.setItem('contras.hideWeakPasswordWarnings', 'true')
                          window.dispatchEvent(new Event('contras:weak-passwords-toggled'))
                          window.dispatchEvent(new Event('contras:open-settings'))
                        }}
                      />
                    )}
                           {/* Quick Travel for identity platforms */}
                    {pwMethod?.password && (
                      <div className="absolute bottom-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          title="Copiar contraseña"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await navigator.clipboard.writeText(pwMethod.password)
                              setQuickTravelCopied(`identity-${platform.id}-pw`)
                              setTimeout(() => setQuickTravelCopied(null), 2000)
                            } catch {}
                          }}
                          className={`p-1.5 rounded-lg shadow-sm border transition-all ${
                            quickTravelCopied === `identity-${platform.id}-pw`
                              ? 'bg-green-500 text-white border-green-400'
                              : 'bg-white/95 text-text-secondary border-black/10 hover:text-indigo-600'
                          }`}
                        >
                          {quickTravelCopied === `identity-${platform.id}-pw` ? (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          )}
                        </button>
                        <button
                          type="button"
                          title="Viaje Rápido (Copiar y abrir)"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await navigator.clipboard.writeText(pwMethod.password)
                              setQuickTravelCopied(`identity-${platform.id}-travel`)
                              setTimeout(() => setQuickTravelCopied(null), 2000)
                              window.open(getPlatformUrl(platform.name), '_blank')
                            } catch {}
                          }}
                          className={`p-1.5 rounded-lg shadow-sm border transition-all ${
                            quickTravelCopied === `identity-${platform.id}-travel`
                              ? 'bg-green-500 text-white border-green-400'
                              : 'bg-white/95 text-text-secondary border-black/10 hover:text-indigo-600'
                          }`}
                        >
                          {quickTravelCopied === `identity-${platform.id}-travel` ? (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {view === 'create' && editingPlatform && (
          <AccountForm
            mode="create"
            identityEmail={editingPlatform.identityEmail}
            initialAccount={editingPlatform.platform}
            onSave={async (platform) => {
              await onAddPlatform(editingPlatform.identityId, platform)
              resetView()
            }}
            onCancel={resetView}
            onUnsavedStateChange={onUnsavedStateChange}
          />
        )}

        {view === 'edit' && editingPlatform && (
          <AccountForm
            mode="edit"
            identityEmail={editingPlatform.identityEmail}
            initialAccount={editingPlatform.platform}
            onSave={async (platform, targetIdentityId) => {
              if (targetIdentityId && targetIdentityId !== editingPlatform.identityId) {
                await onDeletePlatform(editingPlatform.identityId, editingPlatform.platform.id)
                await onAddPlatform(targetIdentityId, platform)
              } else {
                await onUpdatePlatform(editingPlatform.identityId, editingPlatform.platform.id, platform)
              }
              resetView()
            }}
            onCancel={resetView}
            onUnsavedStateChange={onUnsavedStateChange}
            onDelete={async () => {
              await onDeletePlatform(editingPlatform.identityId, editingPlatform.platform.id)
              resetView()
            }}
            onShare={() => editingPlatform && setShowShareModal({ type: 'single', platform: editingPlatform.platform })}
          />
        )}

        {view === 'create' && editingLocalItem && (
          <VaultItemForm
            item={editingLocalItem}
            onSave={async (item) => {
              await onSaveLocalItem(item)
              resetView()
            }}
            onCancel={resetView}
            onUnsavedStateChange={onUnsavedStateChange}
            onRequestNavigation={onRequestNavigation}
          />
        )}

        {view === 'edit' && editingLocalItem && (
          <VaultItemForm
            item={editingLocalItem}
            onSave={async (item) => {
              await onSaveLocalItem(item)
              resetView()
            }}
            onCancel={resetView}
            onUnsavedStateChange={onUnsavedStateChange}
            onRequestNavigation={onRequestNavigation}
            onDelete={async () => {
              await onDeleteLocalItem(editingLocalItem.id)
              resetView()
            }}
          />
        )}
        
        {showShareModal && (
          <ShareModal
            payload={showShareModal}
            onClose={() => setShowShareModal(null)}
          />
        )}
      </div>
    </div>
  )
})


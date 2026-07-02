import { useEffect, useMemo, useState, memo } from 'react'
import type { Identity, LocalCategory, LocalVaultItem, Platform, VaultGroupMode, SortMode } from '../types'
import { createPlatform } from '../utils/identity'
import { createLocalVaultItem, LOCAL_ITEM_LABELS, vaultItemDisplayName } from '../utils/vaultItem'
import { passwordStrengthIssue } from '../utils/security'
import { AccountForm, type UnsavedFormActions } from './AccountForm'
import { EmptyState } from './EmptyState'
import { PlatformLogo } from './ui/PlatformLogo'
import { SearchBar } from './SearchBar'
import { VaultItemForm } from './VaultItemForm'
import { getCanonicalPlatformName } from '../utils/platformUtils'

type ViewMode = 'grid' | 'create' | 'edit'

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
  sortMode: SortMode
  onSortModeChange?: (mode: SortMode) => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
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
}

const SORT_LABELS: Record<SortMode, string> = {
  'alpha-asc': 'Alfabético (A-Z)',
  'alpha-desc': 'Alfabético (Z-A)',
  'created-desc': 'Recién creadas',
  'created-asc': 'Más antiguas',
  'access-desc': 'Recién consultadas',
  'usage-desc': 'Más usadas',
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
  sortMode,
  onSortModeChange,
  searchQuery = '',
  onSearchChange,
}: MainAreaProps) {
  const [view, setView] = useState<ViewMode>('grid')
  const [editingPlatform, setEditingPlatform] = useState<EditingPlatformContext | null>(null)
  const [editingLocalItem, setEditingLocalItem] = useState<LocalVaultItem | null>(null)
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
    const platformData = new Map<string, { name: string; count: number; minDate: string; maxDate: string }>()
    identities.forEach((item) => {
      (item?.platforms || []).forEach((platform) => {
        const name = platform?.name?.trim()
        if (!name) return
        const key = name.toLowerCase()
        const date = platform.createdAt || new Date(0).toISOString()
        const existing = platformData.get(key)
        const canonicalName = getCanonicalPlatformName(name)
        if (existing) {
          existing.count += 1
          if (date < existing.minDate) existing.minDate = date
          if (date > existing.maxDate) existing.maxDate = date
        } else {
          platformData.set(key, {
            name: canonicalName,
            count: 1,
            minDate: date,
            maxDate: date,
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
        return b.maxDate.localeCompare(a.maxDate) // fallback
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
            <div className="rounded-[28px] border border-black/[0.06] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.96),_rgba(248,250,252,0.92)_46%,_rgba(241,245,249,0.94))] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur xl:p-8">
              <div className="grid gap-6">
                <section className="space-y-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">
                      {groupMode === 'platform' ? 'Vista por plataforma' : groupMode === 'local' ? 'Bóveda Local' : 'Tus Identidades'}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
                      {groupMode === 'platform' ? 'Explora tus accesos con una vista visual' : groupMode === 'local' ? 'Gestiona tus notas y secretos locales' : 'Gestiona tus cuentas por identidad'}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
                      {groupMode === 'platform'
                        ? 'Selecciona una plataforma para ver las cuentas, comparar accesos y editar.'
                        : groupMode === 'local'
                        ? 'Selecciona una categoría para ver tus secretos locales.'
                        : 'Selecciona una identidad para ver todas las plataformas y cuentas vinculadas.'}
                    </p>
                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        onClick={() => onCreate()}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Crear {groupMode === 'platform' ? 'Cuenta' : groupMode === 'local' ? 'Secreto Local' : 'Identidad'}
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
                  </div>

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
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-text-primary">{getCanonicalPlatformName(platform.name)}</span>
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
                    ) : (
                      renderProactiveEmptyState({
                        description: 'Crea uno nuevo aquí y aparecerá agrupado por plataforma cuando lo guardes.',
                        actionLabel: 'Crea uno nuevo aquí',
                        onAction: onCreate,
                      })
                    )
                  ) : groupMode === 'local' ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface-subtle py-12 text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
                        <svg className="h-6 w-6 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <h3 className="text-base font-bold text-text-primary">Selecciona una categoría</h3>
                      <p className="mt-1 max-w-sm text-sm text-text-secondary">Elige una categoría de la bóveda local en la barra lateral para ver o añadir secretos.</p>
                    </div>
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
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-text-primary">{idItem.email}</span>
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
  const showInnerTools = !isFormView && Boolean(localCategory || selectedPlatformName || identity)

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

        {(groupMode === 'platform' && !localCategory) || isMobile ? null : (
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
            {showInnerTools && (
              <div className="mb-4 flex gap-2">
                <div className="min-w-0 flex-1">
                  <SearchBar
                    value={searchQuery}
                    onChange={onSearchChange ?? (() => undefined)}
                    placeholder={identity ? 'Buscar en esta identidad...' : selectedPlatformName ? 'Buscar cuentas...' : 'Buscar secretos...'}
                  />
                </div>
                <select
                  value={sortMode}
                  onChange={(event) => onSortModeChange?.(event.target.value as SortMode)}
                  className="h-11 shrink-0 rounded-xl border border-black/[0.06] bg-white px-3 text-xs font-bold text-text-secondary shadow-subtle outline-none focus:border-black/15"
                  aria-label="Ordenar"
                >
                  {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                    <option key={mode} value={mode}>{SORT_LABELS[mode]}</option>
                  ))}
                </select>
              </div>
            )}
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
                  {filteredPlatformAccounts.map(({ identityId, identityEmail, platform }, index) => (
                    <button
                      key={`${identityId}-${platform.id}`}
                      type="button"
                      onClick={() => {
                        setEditingPlatform({ identityId, identityEmail, platform })
                        setView('edit')
                      }}
                      style={{ animationDelay: `${index * 45}ms` }}
                      className="animate-vault-slide-up relative flex min-h-[112px] items-start gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-gradient-to-b from-white via-white to-slate-50/90 p-4 text-left shadow-[0_18px_55px_rgba(15,23,42,0.05)] backdrop-blur transition-all duration-150 hover:-translate-y-1 hover:scale-[1.02] hover:border-black/10 hover:shadow-[0_24px_70px_rgba(15,23,42,0.08)] active:scale-[0.98]"
                    >
                      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
                      <PlatformLogo name={getCanonicalPlatformName(platform.name)} className="h-9 w-9" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-text-primary min-h-[20px] pr-5">
                          {platform.username}
                        </span>
                        {(!hideWarnings && passwordStrengthIssue(platform.accessMethods?.find(m => m?.type === 'PASSWORD')?.password || '') && !platform.ignoreWeakPasswordWarning) && (
                          <div className="absolute right-3 top-3 text-amber-500" title="Contraseña débil o insegura">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
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
                  ))}
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
                {identityPlatforms.map((platform, index) => (
                  <button
                    key={platform.id}
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
                    className="animate-vault-slide-up relative flex min-h-[112px] items-start gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-gradient-to-b from-white via-white to-slate-50/90 p-4 text-left shadow-[0_18px_55px_rgba(15,23,42,0.05)] backdrop-blur transition-all duration-150 hover:-translate-y-1 hover:scale-[1.02] hover:border-black/10 hover:shadow-[0_24px_70px_rgba(15,23,42,0.08)] active:scale-[0.98]"
                  >
                    <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
                    <PlatformLogo name={platform.name} className="h-9 w-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text-primary pr-5">
                        {platform.name}
                      </span>
                      {(!hideWarnings && passwordStrengthIssue(platform.accessMethods?.find(m => m?.type === 'PASSWORD')?.password || '') && !platform.ignoreWeakPasswordWarning) && (
                        <div className="absolute right-3 top-3 text-amber-500" title="Contraseña débil o insegura">
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
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
                ))}
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
      </div>
    </div>
  )
})


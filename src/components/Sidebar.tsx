import { useEffect, useState, useMemo, memo } from 'react'
import type { Identity, LocalCategory, LocalVaultItem, LocalVaultItemType, VaultGroupMode, SortMode } from '../types'
import { useToast } from './ui/ToastProvider'
import { useVault } from '../context/VaultContext'
import { getFriendlyErrorMessage } from '../utils/errors'
import { LOCAL_IDENTITY_EMAIL } from '../utils/identity'
import { LOCAL_ITEM_LABELS, PRESET_LOCAL_CATEGORIES, normalizeLocalCategory } from '../utils/vaultItem'
import { PlatformLogo } from './ui/PlatformLogo'
import { getCanonicalPlatformName } from '../utils/platformUtils'
import { generateId } from '../utils/id'

interface SidebarProps {
  identities: Identity[]
  localItems: LocalVaultItem[]
  groupMode: VaultGroupMode
  selectedId: string | null
  selectedPlatformName: string | null
  selectedLocalCategory: LocalCategory | null
  searchQuery: string
  onGroupModeChange: (mode: VaultGroupMode) => void
  onSelect: (id: string | null) => void
  onSelectPlatform: (platformName: string | null) => void
  onSelectLocalCategory: (category: LocalCategory | null) => void
  onAddIdentity: (email: string) => Promise<void>
  onDeleteIdentity: (id: string) => Promise<void>
  onLock: () => void
  onSync: () => void
  isOpen: boolean
  onClose: () => void
  onOpenSettings: () => void
  profileName?: string | null
  isMobile?: boolean
  installPromptAvailable?: boolean
  onInstall?: () => void
  syncing?: boolean
  syncIndicator?: React.ReactNode
  showAddForm: boolean
  onToggleAddForm: (show?: boolean) => void
  onAddClick: () => void
  sortMode: SortMode
  onSortModeChange: (mode: SortMode) => void
}



function recentTime(...values: Array<string | undefined>): number {
  return values.reduce((latest, value) => {
    const time = value ? Date.parse(value) : 0
    return Number.isFinite(time) ? Math.max(latest, time) : latest
  }, 0)
}

export const Sidebar = memo(function Sidebar({
  identities,
  localItems,
  groupMode,
  selectedId,
  selectedPlatformName,
  selectedLocalCategory,
  searchQuery,
  onGroupModeChange,
  onSelect,
  onSelectPlatform,
  onSelectLocalCategory,
  onAddIdentity,
  onDeleteIdentity,
  onSync,
  isOpen,
  onClose,
  profileName,
  isMobile = false,
  installPromptAvailable = false,
  onInstall,
  syncing = false,
  syncIndicator,
  showAddForm,
  onToggleAddForm,
  onAddClick,
  sortMode,
}: SidebarProps) {
  const { cloudUserEmail, cloudSyncStatus, localCategories, saveLocalCategory } = useVault()
  const { showToast } = useToast()
  const [newIdentityEmail, setNewIdentityEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [showCheck, setShowCheck] = useState(false)
  const [pendingDeleteIdentityId, setPendingDeleteIdentityId] = useState<string | null>(null)
  const [sidebarError, setSidebarError] = useState<string | null>(null)
  const query = searchQuery.trim().toLowerCase()
  const localLooksEmpty = (identities.length === 0 || (identities.length === 1 && (identities[0]?.platforms || []).length === 0 && !identities[0]?.email)) && localItems.length === 0
  const cloudIdentities = useMemo(
    () => identities.filter((identity) => identity?.email !== LOCAL_IDENTITY_EMAIL),
    [identities],
  )
  const visibleIdentities = useMemo(
    () => (query
      ? cloudIdentities.filter((identity) => identity?.email.toLowerCase().includes(query))
      : cloudIdentities),
    [cloudIdentities, query],
  )
  const platformSummaries = useMemo(() => {
    const platformData = new Map<string, { name: string; count: number; minDate: string; maxDate: string }>()
    for (const identity of cloudIdentities) {
      for (const platform of (identity?.platforms || [])) {
        const name = platform.name.trim()
        if (!name) continue
        const key = name.toLowerCase()
        const date = platform.createdAt || new Date(0).toISOString()
        const existing = platformData.get(key)
        if (existing) {
          existing.count += 1
          if (date < existing.minDate) existing.minDate = date
          if (date > existing.maxDate) existing.maxDate = date
        } else {
          platformData.set(key, {
            name,
            count: 1,
            minDate: date,
            maxDate: date,
          })
        }
      }
    }

    let list = Array.from(platformData.values())
    if (query) {
      list = list.filter((p) => p.name.toLowerCase().includes(query))
    }

    list.sort((a, b) => {
      switch (sortMode) {
        case 'alpha-asc':
          return a.name.localeCompare(b.name)
        case 'alpha-desc':
          return b.name.localeCompare(a.name)
        case 'created-desc':
          return b.maxDate.localeCompare(a.maxDate)
        case 'created-asc':
          return a.minDate.localeCompare(b.minDate)
        case 'access-desc':
          return b.maxDate.localeCompare(a.maxDate)
        case 'usage-desc':
          return b.count - a.count || a.name.localeCompare(b.name)
        default:
          return 0
      }
    })
    return list
  }, [cloudIdentities, query, sortMode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsOnline(window.navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const localCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of localItems) {
      const id = item.categoryId ?? item.type
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }, [localItems])

  const localCategoryOptions: LocalCategory[] = useMemo(() => {
    const categoriesFromItems = localItems.reduce<LocalCategory[]>((categories, item) => {
      const id = item.categoryId ?? item.type
      if (id === item.type || categories.some((category) => category.id === id)) return categories
      categories.push({
        id,
        label: item.categoryLabel?.trim() || item.title || LOCAL_ITEM_LABELS[item.type],
        type: item.type,
        custom: true,
        updatedAt: item.updatedAt,
        createdAt: item.createdAt,
      })
      return categories
    }, [])

    return [
      ...(Object.keys(LOCAL_ITEM_LABELS) as LocalVaultItemType[]).map((type) => ({
        id: type,
        label: LOCAL_ITEM_LABELS[type],
        type,
        custom: false,
      })),
      ...PRESET_LOCAL_CATEGORIES,
      ...localCategories,
      ...categoriesFromItems.filter(
        (fromItem) =>
          !localCategories.some((custom) => custom.id === fromItem.id) &&
          !PRESET_LOCAL_CATEGORIES.some((preset) => preset.id === fromItem.id),
      ),
    ]
  }, [localCategories, localItems])

  const visibleLocalCategories = useMemo(
    () => (query
      ? localCategoryOptions.filter((category) => category.label.toLowerCase().includes(query))
      : localCategoryOptions),
    [localCategoryOptions, query],
  )


  const sidebarIdentities = useMemo(() => {
    if (isMobile) return visibleIdentities
    return [...visibleIdentities]
      .sort((a, b) => recentTime(b.updatedAt, b.createdAt) - recentTime(a.updatedAt, a.createdAt))
      .slice(0, 4)
  }, [isMobile, visibleIdentities])

  const sidebarPlatforms = useMemo(() => {
    if (isMobile) return platformSummaries
    return [...platformSummaries]
      .sort((a, b) => b.maxDate.localeCompare(a.maxDate))
      .slice(0, 4)
  }, [isMobile, platformSummaries])

  const sidebarLocalCategories = useMemo(() => {
    if (isMobile) return visibleLocalCategories
    return [...visibleLocalCategories]
      .sort((a, b) => recentTime(b.updatedAt, b.createdAt) - recentTime(a.updatedAt, a.createdAt))
  }, [isMobile, visibleLocalCategories])

  const handleAddLocalCategory = async () => {
    const label = window.prompt('Nombre de la nueva categoría local')
    const cleanLabel = label?.trim()
    if (!cleanLabel) return

    try {
      const category = normalizeLocalCategory({
        id: `custom-${generateId()}`,
        label: cleanLabel,
        type: 'SECURE_NOTE',
        custom: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      await saveLocalCategory(category)
      setSidebarError(null)
      onSelectLocalCategory(category)
    } catch (error) {
      const message = getFriendlyErrorMessage(error, 'No se pudo crear la sección local.')
      setSidebarError(message)
      showToast(message, 'error')
    }
  }

  useEffect(() => {
    if (cloudSyncStatus === 'synced') {
      setShowCheck(true)
      const timer = setTimeout(() => setShowCheck(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [cloudSyncStatus])

  const handleAddIdentity = async () => {
    const email = newIdentityEmail.trim() || LOCAL_IDENTITY_EMAIL
    setAdding(true)
    try {
      await onAddIdentity(email)
      setSidebarError(null)
      setNewIdentityEmail('')
      onToggleAddForm(false)
    } catch (error) {
      const message = getFriendlyErrorMessage(error, 'No se pudo crear la identidad.')
      setSidebarError(message)
      showToast(message, 'error')
    } finally {
      setAdding(false)
    }
  }
  const activeSyncIndicator = syncIndicator !== undefined ? syncIndicator : (cloudUserEmail ? (
    <div className="flex items-center gap-1.5">
      {!isOnline ? (
        <span className="h-2 w-2 rounded-full bg-text-tertiary" title="Sin conexion" />
      ) : cloudSyncStatus === 'syncing' ? (
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" title="Sincronizando" />
      ) : showCheck ? (
        <span className="h-2 w-2 rounded-full bg-green-500" title="Sincronizado" />
      ) : cloudSyncStatus === 'error' ? (
        <span className="h-2 w-2 rounded-full bg-red-500" title="Error de sincronizacion" />
      ) : null}
    </div>
  ) : null)

  const renderPlatformItem = (platform: { name: string; count: number }) => {
    const selected = selectedPlatformName?.toLowerCase() === platform.name.toLowerCase()
    const canonicalName = getCanonicalPlatformName(platform.name)
    return (
      <li key={platform.name}>
        <button
          type="button"
          onClick={() => onSelectPlatform(platform.name)}
          className={`group flex min-h-[86px] w-full items-center gap-3 rounded-2xl border p-3.5 text-left shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-150 active:scale-[0.98] ${
            selected ? 'border-black/10 bg-white text-text-primary shadow-[0_16px_40px_rgba(15,23,42,0.08)]' : 'border-black/[0.06] bg-white/82 text-text-secondary hover:-translate-y-0.5 hover:border-black/10 hover:bg-white'
          }`}
        >
          <PlatformLogo name={canonicalName} className="h-11 w-11 rounded-2xl border border-black/[0.05] bg-white p-1 shadow-sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-text-primary">{canonicalName}</span>
            <span className="mt-1 block text-xs font-medium text-text-secondary">
              {platform.count} cuenta{platform.count !== 1 ? 's' : ''} vinculada{platform.count !== 1 ? 's' : ''}
            </span>
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-text-secondary transition-colors group-hover:bg-slate-200">Abrir</span>
        </button>
      </li>
    )
  }

  const renderLocalCategoryItem = (category: LocalCategory, index: number) => {
    const selected = selectedLocalCategory?.id === category.id
    const count = localCategoryCounts.get(category.id) ?? 0
    return (
      <li key={category.id}>
        <button
          type="button"
          onClick={() => onSelectLocalCategory(category)}
          style={{ animationDelay: `${index * 35}ms` }}
          className={`group animate-vault-slide-up flex min-h-[86px] w-full items-center gap-3 rounded-2xl border p-3.5 text-left shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-150 active:scale-[0.98] ${
            selected ? 'border-black/10 bg-white text-text-primary shadow-[0_16px_40px_rgba(15,23,42,0.08)]' : 'border-black/[0.06] bg-white/82 text-text-secondary hover:-translate-y-0.5 hover:scale-[1.01] hover:border-black/10 hover:bg-white hover:shadow-lg'
          }`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-black/[0.05] bg-white text-text-primary shadow-sm">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-6a2.25 2.25 0 00-2.25-2.25h-4.879a2.25 2.25 0 01-1.59-.659L9.659 4.22A2.25 2.25 0 008.069 3.56H6.75A2.25 2.25 0 004.5 5.81v12.44A2.25 2.25 0 006.75 20.5h10.5a2.25 2.25 0 002.25-2.25v-4z" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-text-primary">{category.label}</span>
            <span className="mt-1 block text-xs font-medium text-text-secondary">
              {count} elemento{count !== 1 ? 's' : ''} local{count !== 1 ? 'es' : ''}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {category.custom && <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-text-secondary">Tag</span>}
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-text-secondary transition-colors group-hover:bg-slate-200">Abrir</span>
          </span>
        </button>
      </li>
    )
  }

  const renderEmptyNavigationState = (label: string, onCreate: () => void) => (
    <div className="mx-3 mt-4 rounded-2xl border border-dashed border-border bg-white/70 px-4 py-8 text-center shadow-[0_12px_30px_rgba(15,23,42,0.04)] animate-vault-morph">
      <p className="text-sm font-bold text-text-primary">Aún no tienes elementos aquí</p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-text-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]"
      >
        <span>{label}</span>
        <span aria-hidden="true">➔</span>
      </button>
    </div>
  )

  const renderIdentityItem = (identity: Identity) => {
    const selected = identity.id === selectedId
    const platformCount = (identity?.platforms || []).length
    return (
      <li key={identity.id}>
        <div
          className={`group relative rounded-2xl border p-3.5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-150 ${
            selected ? 'border-black/10 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]' : 'border-black/[0.06] bg-white/82 hover:-translate-y-0.5 hover:border-black/10 hover:bg-white'
          }`}
        >
          <button type="button" onClick={() => onSelect(identity.id)} className="flex min-h-[74px] w-full items-center gap-3 text-left active:scale-[0.99]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 font-bold text-text-primary ring-1 ring-black/5">
              {identity.email.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-text-primary">{identity.email}</span>
              <span className="mt-1 block text-xs font-medium text-text-secondary">
                {platformCount} plataforma{platformCount !== 1 ? 's' : ''} vinculada{platformCount !== 1 ? 's' : ''}
              </span>
              {platformCount > 0 && (
                <span className="mt-2 flex items-center gap-2">
                  <span className="flex -space-x-2">
                    {(identity?.platforms || []).slice(0, 3).map((platform) => (
                      <PlatformLogo key={`${identity.id}-${platform.id}`} name={platform.name} className="h-6 w-6 rounded-lg border border-white bg-white p-0.5 shadow-sm" />
                    ))}
                  </span>
                  <span className="truncate text-[11px] font-medium text-text-tertiary">
                    {(identity?.platforms || []).slice(0, 2).map((platform) => platform.name).join(' · ')}
                    {platformCount > 2 ? ` +${platformCount - 2}` : ''}
                  </span>
                </span>
              )}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-text-secondary transition-colors group-hover:bg-slate-200">Abrir</span>
          </button>
          <button
            type="button"
            onClick={() => setPendingDeleteIdentityId(pendingDeleteIdentityId === identity.id ? null : identity.id)}
            className="absolute right-2 top-2 rounded-xl p-2 text-text-tertiary opacity-100 transition-colors hover:bg-red-50 hover:text-red-600 lg:opacity-0 lg:group-hover:opacity-100"
            aria-label="Eliminar identidad"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {pendingDeleteIdentityId === identity.id && (
          <div className="mx-3 mt-2 rounded-xl border border-red-100 bg-red-50/80 px-3 py-2 text-xs text-red-700">
            <p>Se eliminara la identidad y sus plataformas.</p>
            <button type="button" onClick={() => { void onDeleteIdentity(identity.id); setPendingDeleteIdentityId(null) }} className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white">Confirmar eliminacion</button>
          </div>
        )}
      </li>
    )
  }

  return (
    <>
      {!isMobile && isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-label="Cerrar panel lateral"
        />
      )}

      <aside
        className={
          isMobile
            ? 'flex h-full w-full flex-col bg-surface'
            : `
              fixed inset-y-0 left-0 z-30 flex h-screen w-full max-w-[320px] flex-col
              border-r border-border-subtle bg-surface transition-transform duration-300 ease-out
              lg:sticky lg:top-0 lg:z-auto lg:w-80 lg:max-w-none lg:translate-x-0
              \${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `
        }
        aria-label="Lista de identidades"
      >
        <header className="flex items-start justify-between px-4 pb-3 pt-4 lg:px-5 lg:pt-5">
          <div className="min-w-0 text-left">
            {!isMobile && (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-text-primary">Contras</h1>
                  {activeSyncIndicator}
                </div>
                {profileName && (
                  <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                    {profileName}
                  </p>
                )}
              </>
            )}
          </div>
        </header>

        {showAddForm && (
          <div className="px-4 pb-3 lg:px-5">
            <div className="flex gap-2">
              <input
                type="email"
                value={newIdentityEmail}
                onChange={(event) => setNewIdentityEmail(event.target.value)}
                placeholder="correo@ejemplo.com"
                className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-sm outline-none transition-colors focus:border-border"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleAddIdentity()
                }}
              />
              <button
                type="button"
                onClick={handleAddIdentity}
                disabled={adding}
                className="rounded-lg bg-text-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {adding ? '...' : 'OK'}
              </button>
            </div>
          </div>
        )}

        {isMobile && sidebarError && (
          <div className="px-4 pb-3">
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {sidebarError}
            </div>
          </div>
        )}

        {!isMobile && (
          <div className="px-4 pb-3 lg:px-5">
            {sidebarError && (
              <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {sidebarError}
              </div>
            )}
            <div className="mb-3 grid grid-cols-3 rounded-xl border border-black/[0.06] bg-surface-elevated p-1 shadow-subtle">
              {(['identity', 'platform', 'local'] as VaultGroupMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onGroupModeChange(mode)}
                  className={`min-h-10 rounded-lg px-2 py-1.5 text-xs font-bold transition-all duration-150 ${
                    groupMode === mode
                      ? 'bg-text-primary text-white shadow-[0_8px_22px_rgba(15,23,42,0.14)]'
                      : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {mode === 'identity' ? 'Identidades' : mode === 'platform' ? 'Plataformas' : 'Locales'}
                </button>
              ))}
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 pb-4 lg:px-3">
          {syncing && localLooksEmpty ? (
            <div className="space-y-4 px-3 py-4 animate-pulse">
              <div className="h-3 bg-black/10 rounded w-1/3 dark:bg-white/10 mb-6"></div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-1">
                    <div className="h-8 w-8 rounded-xl bg-black/10 dark:bg-white/10" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-black/10 rounded w-3/4 dark:bg-white/10" />
                      <div className="h-2.5 bg-black/10 rounded w-1/2 dark:bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {groupMode !== 'local' && (
                <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
                  {groupMode === 'identity' ? 'Identidades Cloud' : 'Plataformas Cloud'}
                </div>
              )}
              {groupMode === 'platform' ? (
                sidebarPlatforms.length === 0 ? (
                  renderEmptyNavigationState('Crea una plataforma aquí', onAddClick)
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelectPlatform(null)}
                      className={`mb-4 flex min-h-[76px] w-full items-center justify-between rounded-2xl border border-black/[0.04] px-3.5 py-3 text-left shadow-sm transition-colors ${
                        selectedPlatformName === null ? 'bg-surface-active text-text-primary' : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/5 text-text-primary">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                          </svg>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">Directorio de Plataformas</span>
                          <span className="mt-0.5 block text-[11px] font-medium text-text-tertiary">Todas tus plataformas cloud</span>
                        </span>
                      </span>
                      <span className="flex h-7 min-w-[28px] shrink-0 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold tabular-nums text-text-secondary shadow-sm ring-1 ring-black/[0.04]">
                        {platformSummaries.length}
                      </span>
                    </button>
                    {searchQuery ? (
                      <ul className="space-y-3 animate-vault-morph">
                        {sidebarPlatforms
                          .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(renderPlatformItem)}
                      </ul>
                    ) : (
                      <div className="animate-vault-morph">

                        {sidebarPlatforms.length > 0 && (
                          <>
                            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
                              {isMobile ? 'Todas' : 'Más recientes'}
                            </div>
                            <ul className="space-y-3">
                              {sidebarPlatforms.map(renderPlatformItem)}
                            </ul>
                          </>
                        )}
                        
                      </div>
                    )}
                  </>
                )
              ) : groupMode === 'identity' ? (
                sidebarIdentities.length === 0 ? (
                  renderEmptyNavigationState('Crea una identidad aquí', onAddClick)
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelect(null)}
                      className={`mb-4 flex min-h-[76px] w-full items-center justify-between rounded-2xl border border-black/[0.04] px-3.5 py-3 text-left shadow-sm transition-colors ${
                        selectedId === null ? 'bg-surface-active text-text-primary' : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/5 text-text-primary">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">Directorio de Identidades</span>
                          <span className="mt-0.5 block text-[11px] font-medium text-text-tertiary">Correos y perfiles cloud</span>
                        </span>
                      </span>
                      <span className="flex h-7 min-w-[28px] shrink-0 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold tabular-nums text-text-secondary shadow-sm ring-1 ring-black/[0.04]">
                        {visibleIdentities.length}
                      </span>
                    </button>
                    {searchQuery ? (
                      <ul className="space-y-3 animate-vault-morph">
                        {sidebarIdentities
                          .filter(idItem => idItem.email.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(renderIdentityItem)}
                      </ul>
                    ) : (
                      <div className="animate-vault-morph">

                        {sidebarIdentities.length > 0 && (
                          <>
                            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
                              {isMobile ? 'Todas' : 'Más recientes'}
                            </div>
                            <ul className="space-y-3">
                              {sidebarIdentities.map(renderIdentityItem)}
                            </ul>
                          </>
                        )}

                      </div>
                    )}
                  </>
                )
              ) : groupMode === 'local' ? (
                /* groupMode === 'local' */
                <>
                  <div className="mt-2 flex items-center justify-between px-3 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
                      Categorías Locales
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleAddLocalCategory()}
                      className="rounded-lg border border-black/5 bg-white px-2 py-1 text-[10px] font-bold text-text-secondary shadow-sm transition-colors hover:bg-surface-hover hover:text-text-primary"
                    >
                      + Nueva Categoría
                    </button>
                  </div>
                  <p className="px-3 pb-2 text-[11px] leading-relaxed text-text-tertiary">
                    Espacios privados personalizables para notas, documentos, tarjetas o cualquier dato sensible que no dependa de una plataforma.
                  </p>
                  {sidebarLocalCategories.length === 0 ? (
                    renderEmptyNavigationState('Crea una categoría aquí', () => void handleAddLocalCategory())
                  ) : (
                    <ul className="space-y-3">
                      {sidebarLocalCategories.map(renderLocalCategoryItem)}
                    </ul>
                  )}
                </>
              ) : (
                /* groupMode === 'inbox' */
                <>
                  <div className="mt-2 flex items-center justify-between px-3 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
                      Buzón de Compartidos
                    </span>
                  </div>
                  <p className="px-3 pb-2 text-[11px] leading-relaxed text-text-tertiary">
                    Aquí aparecerán las contraseñas que otros usuarios compartan contigo de forma segura mediante encriptación asimétrica.
                  </p>
                  <div className="mx-3 mt-4 rounded-2xl border border-dashed border-border bg-white/70 px-4 py-8 text-center shadow-[0_12px_30px_rgba(15,23,42,0.04)] animate-vault-morph">
                    <p className="text-sm font-bold text-text-primary">Bandeja Vacía</p>
                    <p className="mt-2 text-xs text-text-tertiary">Todavía no has recibido contraseñas compartidas.</p>
                  </div>
                </>
              )}
            </>
          )}
        </nav>

        {isMobile && installPromptAvailable && onInstall && (
          <footer className="flex flex-col gap-2.5 border-t border-border-subtle bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              {cloudUserEmail && (
                <button
                  type="button"
                  onClick={onSync}
                  disabled={cloudSyncStatus === 'syncing'}
                  className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-black/5 bg-white px-3 text-xs font-bold text-text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-surface-hover disabled:opacity-60"
                >
                  <span className={`h-2 w-2 rounded-full ${cloudSyncStatus === 'syncing' ? 'animate-pulse bg-blue-500' : cloudSyncStatus === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  {cloudSyncStatus === 'syncing' ? 'Sincronizando...' : 'Sincronizar / Refrescar'}
                </button>
              )}
            </div>

            {installPromptAvailable && onInstall && (
              <button
                type="button"
                onClick={onInstall}
                className="w-full rounded-xl bg-text-primary py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              >
                Instalar Contras App
              </button>
            )}
          </footer>
        )}
      </aside>
    </>
  )
})

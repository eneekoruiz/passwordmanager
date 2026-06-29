import { useEffect, useState, useMemo, memo } from 'react'
import type { Identity, LocalCategory, LocalVaultItem, LocalVaultItemType, VaultGroupMode, SortMode } from '../types'
import { SearchBar } from './SearchBar'
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
  onSearchChange: (query: string) => void
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
  isGlobalSearching?: boolean
}

const SORT_LABELS: Record<SortMode, string> = {
  'alpha-asc': 'Alfabéticamente (A-Z)',
  'alpha-desc': 'Alfabéticamente (Z-A)',
  'date-desc': 'Más recientes primero',
  'date-asc': 'Más antiguos primero',
  'usage-desc': 'Más usadas primero',
}

export const Sidebar = memo(function Sidebar({
  identities,
  localItems,
  groupMode,
  selectedId,
  selectedPlatformName,
  selectedLocalCategory,
  searchQuery,
  onSearchChange,
  onGroupModeChange,
  onSelect,
  onSelectPlatform,
  onSelectLocalCategory,
  onAddIdentity,
  onDeleteIdentity,
  onLock,
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
  onSortModeChange,
  isGlobalSearching = false,
}: SidebarProps) {
  const { cloudUserEmail, cloudSyncStatus, localCategories, saveLocalCategory } = useVault()
  const { showToast } = useToast()
  const [newIdentityEmail, setNewIdentityEmail] = useState('')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [adding, setAdding] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [showCheck, setShowCheck] = useState(false)
  const [pendingDeleteIdentityId, setPendingDeleteIdentityId] = useState<string | null>(null)
  const [sidebarError, setSidebarError] = useState<string | null>(null)
  const query = searchQuery.trim().toLowerCase()
  const localLooksEmpty = (identities.length === 0 || (identities.length === 1 && (identities[0]?.platforms || []).length === 0 && !identities[0]?.email)) && localItems.length === 0
  const cloudIdentities = identities.filter((identity) => identity?.email !== LOCAL_IDENTITY_EMAIL)
  const visibleIdentities = query
    ? cloudIdentities.filter((identity) => identity?.email.toLowerCase().includes(query))
    : cloudIdentities
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
        case 'date-desc':
          return b.maxDate.localeCompare(a.maxDate)
        case 'date-asc':
          return a.minDate.localeCompare(b.minDate)
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

  const localCategoryOptions: LocalCategory[] = [
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
    return (
      <li key={platform.name}>
        <button
          type="button"
          onClick={() => onSelectPlatform(platform.name)}
          className={`flex min-h-12 w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors ${
            selected ? 'bg-surface-active' : 'hover:bg-surface-hover'
          }`}
        >
          <span className="flex min-w-0 items-center gap-3">
            <PlatformLogo name={getCanonicalPlatformName(platform.name)} className="h-8 w-8 rounded-xl border border-black/[0.04] bg-white p-0.5 shadow-sm" />
            <span className="truncate text-sm font-semibold text-text-primary/90">
              {getCanonicalPlatformName(platform.name)}
            </span>
          </span>
          <span className="text-xs tabular-nums text-text-tertiary">{platform.count}</span>
        </button>
      </li>
    )
  }

  const renderIdentityItem = (identity: Identity) => {
    const selected = identity.id === selectedId
    return (
      <li key={identity.id}>
        <div
          className={`group flex items-center rounded-lg transition-colors ${
            selected ? 'bg-surface-active' : 'hover:bg-surface-hover'
          }`}
        >
          <button
            type="button"
            onClick={() => onSelect(identity.id)}
            className="min-w-0 flex-1 px-3 py-2.5 text-left"
          >
            <span className="block truncate text-[15px] font-semibold text-text-primary/95">
              {identity.email}
            </span>
            {(identity?.platforms || []).length > 0 ? (
              <span className="mt-2 flex items-center gap-2">
                <span className="flex -space-x-2">
                  {(identity?.platforms || []).slice(0, 3).map((platform) => (
                    <PlatformLogo
                      key={`${identity.id}-${platform.id}`}
                      name={platform.name}
                      className="h-6 w-6 rounded-lg border border-white bg-white p-0.5 shadow-sm"
                    />
                  ))}
                </span>
                <span className="truncate text-[11px] font-medium text-text-tertiary">
                  {(identity?.platforms || [])
                    .slice(0, 2)
                    .map((platform) => platform.name)
                    .join(' · ')}
                  {(identity?.platforms || []).length > 2 ? ` +${(identity?.platforms || []).length - 2}` : ''}
                </span>
              </span>
            ) : (
              <span className="mt-1 block text-[11px] font-medium text-text-tertiary">
                Aún no hay plataformas vinculadas
              </span>
            )}
          </button>
          <span className="shrink-0 px-1 text-xs tabular-nums text-text-tertiary">
            {(identity?.platforms || []).length}
          </span>
          <button
            type="button"
            onClick={() =>
              setPendingDeleteIdentityId(
                pendingDeleteIdentityId === identity.id ? null : identity.id,
              )
            }
            className="mr-1 rounded-md p-1.5 text-text-tertiary opacity-100 transition-colors hover:bg-red-50 hover:text-red-600 lg:opacity-0 lg:group-hover:opacity-100"
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
            <button
              type="button"
              onClick={() => {
                void onDeleteIdentity(identity.id)
                setPendingDeleteIdentityId(null)
              }}
              className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white"
            >
              Confirmar eliminacion
            </button>
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
          <div className="flex items-center gap-1">
            {!isMobile && (
              <button
                type="button"
                onClick={onAddClick}
                className="min-h-11 min-w-11 rounded-xl p-2.5 text-text-secondary transition-colors hover:bg-surface-hover"
                aria-label="Añadir identidad"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            )}
            {!isMobile && (
              <button
                type="button"
                onClick={onLock}
                className="min-h-11 min-w-11 rounded-xl p-2.5 text-text-secondary transition-colors hover:bg-surface-hover"
                aria-label="Bloquear boveda"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </button>
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
                  {mode === 'identity' ? 'Identidad' : mode === 'platform' ? 'Plataforma' : 'Locales'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <SearchBar
                  value={searchQuery}
                  onChange={onSearchChange}
                  placeholder={isGlobalSearching ? 'Búsqueda global activa' : (groupMode === 'identity' ? 'Buscar identidades...' : 'Buscar plataformas...')}
                  disabled={isGlobalSearching}
                />
              </div>
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSortMenu((v) => !v)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/[0.06] bg-white text-text-secondary shadow-[0_2px_8px_rgba(0,0,0,0.015)] transition-all hover:bg-surface-hover hover:text-text-primary active:scale-[0.95]"
                  aria-label="Ordenar lista"
                  title={`Ordenar: ${SORT_LABELS[sortMode]}`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h18M3 12h18M3 19.5h18" />
                  </svg>
                </button>

                {showSortMenu && (
                  <>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowSortMenu(false)}
                      className="fixed inset-0 z-40 cursor-default bg-transparent outline-none"
                    />
                    <div className="absolute right-0 mt-2 z-50 w-56 rounded-2xl border border-black/5 bg-white/95 p-1.5 shadow-[0_15px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl animate-vault-morph text-left">
                      <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-text-tertiary">
                        Ordenar por
                      </div>
                      {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            onSortModeChange(mode)
                            setShowSortMenu(false)
                          }}
                          className={`flex min-h-10 w-full items-center justify-between rounded-xl px-3 text-xs font-semibold transition-colors ${
                            sortMode === mode
                              ? 'bg-text-primary text-white'
                              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                          }`}
                        >
                          <span>{SORT_LABELS[mode]}</span>
                          {sortMode === mode && (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 pb-4 lg:px-3 max-lg:max-h-[calc(100dvh-13rem)]">
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
                platformSummaries.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-text-tertiary">No hay plataformas.</p>
                ) : (
                  <>
                    <ul className="space-y-1 mb-4">
                      <li>
                        <button
                          type="button"
                          onClick={() => onSelectPlatform(null)}
                          className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                            selectedPlatformName === null ? 'bg-surface-active font-bold text-text-primary' : 'hover:bg-surface-hover text-text-secondary font-medium'
                          }`}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/5 text-text-primary">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                            </svg>
                          </div>
                          <span className="truncate text-sm">Directorio de Plataformas</span>
                        </button>
                      </li>
                    </ul>
                    {searchQuery ? (
                      <ul className="space-y-0.5 animate-vault-morph">
                        {platformSummaries
                          .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(renderPlatformItem)}
                      </ul>
                    ) : (
                      <div className="animate-vault-morph">
                        <div className="mx-3 mb-6 grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-black/[0.04] bg-surface-elevated p-3 shadow-sm">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Plataformas</p>
                            <p className="mt-1 text-xl font-bold text-text-primary">{platformSummaries.length}</p>
                          </div>
                          <div className="rounded-xl border border-black/[0.04] bg-surface-elevated p-3 shadow-sm">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Cuentas</p>
                            <p className="mt-1 text-xl font-bold text-text-primary">{platformSummaries.reduce((acc, p) => acc + p.count, 0)}</p>
                          </div>
                        </div>

                        {platformSummaries.length > 0 && (
                          <>
                            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
                              Recientes
                            </div>
                            <ul className="space-y-0.5">
                              {[...platformSummaries].sort((a, b) => b.maxDate.localeCompare(a.maxDate)).slice(0, 5).map(renderPlatformItem)}
                            </ul>
                          </>
                        )}
                        
                        {selectedPlatformName && ![...platformSummaries].sort((a, b) => b.maxDate.localeCompare(a.maxDate)).slice(0, 5).find(p => p.name.toLowerCase() === selectedPlatformName.toLowerCase()) && (
                          <>
                            <div className="mt-4 px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
                              Seleccionada
                            </div>
                            <ul className="space-y-0.5">
                              {platformSummaries.filter(p => p.name.toLowerCase() === selectedPlatformName.toLowerCase()).map(renderPlatformItem)}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )
              ) : groupMode === 'identity' ? (
                visibleIdentities.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-text-tertiary">No hay identidades.</p>
                ) : (
                  <>
                    <ul className="space-y-1 mb-4">
                      <li>
                        <button
                          type="button"
                          onClick={() => onSelect(null)}
                          className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                            selectedId === null ? 'bg-surface-active font-bold text-text-primary' : 'hover:bg-surface-hover text-text-secondary font-medium'
                          }`}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/5 text-text-primary">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                          </div>
                          <span className="truncate text-sm">Directorio de Identidades</span>
                        </button>
                      </li>
                    </ul>
                    {searchQuery ? (
                      <ul className="space-y-0.5 animate-vault-morph">
                        {visibleIdentities
                          .filter(idItem => idItem.email.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(renderIdentityItem)}
                      </ul>
                    ) : (
                      <div className="animate-vault-morph">
                        <div className="mx-3 mb-6 grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-black/[0.04] bg-surface-elevated p-3 shadow-sm">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Identidades</p>
                            <p className="mt-1 text-xl font-bold text-text-primary">{visibleIdentities.length}</p>
                          </div>
                          <div className="rounded-xl border border-black/[0.04] bg-surface-elevated p-3 shadow-sm">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Cuentas</p>
                            <p className="mt-1 text-xl font-bold text-text-primary">{visibleIdentities.reduce((acc, idItem) => acc + (idItem.platforms || []).length, 0)}</p>
                          </div>
                        </div>

                        {visibleIdentities.length > 0 && (
                          <>
                            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
                              Recientes
                            </div>
                            <ul className="space-y-0.5">
                              {[...visibleIdentities].sort((a, b) => {
                                const maxA = Math.max(...(a.platforms || []).map(p => new Date(p.updatedAt || p.createdAt || 0).getTime()), 0)
                                const maxB = Math.max(...(b.platforms || []).map(p => new Date(p.updatedAt || p.createdAt || 0).getTime()), 0)
                                return maxB - maxA
                              }).slice(0, 5).map(renderIdentityItem)}
                            </ul>
                          </>
                        )}

                        {selectedId && ![...visibleIdentities].sort((a, b) => {
                          const maxA = Math.max(...(a.platforms || []).map(p => new Date(p.updatedAt || p.createdAt || 0).getTime()), 0)
                          const maxB = Math.max(...(b.platforms || []).map(p => new Date(p.updatedAt || p.createdAt || 0).getTime()), 0)
                          return maxB - maxA
                        }).slice(0, 5).find(idItem => idItem.id === selectedId) && (
                          <>
                            <div className="mt-4 px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
                              Seleccionada
                            </div>
                            <ul className="space-y-0.5">
                              {visibleIdentities.filter(idItem => idItem.id === selectedId).map(renderIdentityItem)}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )
              ) : (
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
                  <ul className="space-y-0.5">
                    {localCategoryOptions.map((category) => {
                      const selected = selectedLocalCategory?.id === category.id
                      const count = localItems.filter((item) => (item.categoryId ?? item.type) === category.id).length
                      return (
                        <li key={category.id}>
                          <button
                            type="button"
                            onClick={() => onSelectLocalCategory(category)}
                            className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors ${
                              selected ? 'bg-surface-active' : 'hover:bg-surface-hover'
                            }`}
                          >
                            <span className="truncate text-[15px] font-semibold text-text-primary/90">
                              {category.label}
                            </span>
                            <span className="flex items-center gap-2 text-xs tabular-nums text-text-tertiary">
                              {category.custom && <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold">Tag</span>}
                              {count}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </nav>

        {(!isMobile || (installPromptAvailable && onInstall)) && (
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



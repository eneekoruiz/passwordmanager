import { useEffect, useState } from 'react'
import type { Identity, LocalVaultItem, LocalVaultItemType, VaultGroupMode } from '../types'
import { SearchBar } from './SearchBar'
import { useVault } from '../context/VaultContext'
import { getFriendlyErrorMessage } from '../utils/errors'
import { LOCAL_IDENTITY_EMAIL } from '../utils/identity'
import { LOCAL_ITEM_LABELS } from '../utils/vaultItem'

interface SidebarProps {
  identities: Identity[]
  localItems: LocalVaultItem[]
  groupMode: VaultGroupMode
  selectedId: string | null
  selectedPlatformName: string | null
  selectedLocalCategory: LocalVaultItemType | null
  searchQuery: string
  onSearchChange: (query: string) => void
  onGroupModeChange: (mode: VaultGroupMode) => void
  onSelect: (id: string) => void
  onSelectPlatform: (platformName: string) => void
  onSelectLocalCategory: (type: LocalVaultItemType) => void
  onAddIdentity: (email: string) => Promise<void>
  onDeleteIdentity: (id: string) => Promise<void>
  onLock: () => void
  isOpen: boolean
  onClose: () => void
  onOpenSettings: () => void
  profileName?: string | null
  isMobile?: boolean
  installPromptAvailable?: boolean
  onInstall?: () => void
}

export function Sidebar({
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
  isOpen,
  onClose,
  onOpenSettings,
  profileName,
  isMobile = false,
  installPromptAvailable = false,
  onInstall,
}: SidebarProps) {
  const { cloudUserEmail, cloudSyncStatus, syncActiveProfileToCloud, logoutCloud } = useVault()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newIdentityEmail, setNewIdentityEmail] = useState('')
  const [sidebarError, setSidebarError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [showCheck, setShowCheck] = useState(false)
  const [pendingDeleteIdentityId, setPendingDeleteIdentityId] = useState<string | null>(null)
  const query = searchQuery.trim().toLowerCase()
  const visibleIdentities = query
    ? identities.filter((identity) => identity.email.toLowerCase().includes(query))
    : identities
  const platformSummaries = identities
    .flatMap((identity) => identity.platforms.map((platform) => platform.name.trim()).filter(Boolean))
    .reduce<Array<{ name: string; count: number }>>((acc, name) => {
      const existing = acc.find((item) => item.name.toLowerCase() === name.toLowerCase())
      if (existing) existing.count += 1
      else acc.push({ name, count: 1 })
      return acc
    }, [])
    .filter((platform) => !query || platform.name.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name))

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
    setSidebarError(null)
    try {
      await onAddIdentity(email)
      setNewIdentityEmail('')
      setShowAddForm(false)
    } catch (error) {
      setSidebarError(getFriendlyErrorMessage(error, 'No se pudo crear la identidad.'))
    } finally {
      setAdding(false)
    }
  }

  const syncIndicator = cloudUserEmail ? (
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
  ) : null

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
              fixed inset-y-0 left-0 z-30 flex w-full max-w-[320px] flex-col
              border-r border-border-subtle bg-surface transition-transform duration-300 ease-out
              lg:static lg:z-auto lg:w-72 lg:max-w-none lg:translate-x-0
              ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `
        }
        aria-label="Lista de identidades"
      >
        <header className="flex items-start justify-between px-4 pb-3 pt-4 lg:px-5 lg:pt-5">
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-text-primary">Contras</h1>
              {syncIndicator}
            </div>
            {profileName && (
              <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                {profileName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowAddForm((value) => !value)}
              className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover"
              aria-label="Añadir identidad"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            {!isMobile && (
              <button
                type="button"
                onClick={onLock}
                className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover"
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

        <div className="px-4 pb-3 lg:px-5">
          {sidebarError && (
            <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {sidebarError}
            </div>
          )}
          <div className="mb-3 grid grid-cols-2 rounded-xl border border-black/[0.06] bg-surface-elevated p-1 shadow-subtle">
            {(['identity', 'platform'] as VaultGroupMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onGroupModeChange(mode)}
                className={`rounded-lg px-2 py-1.5 text-[11px] font-bold transition-all duration-150 ${
                  groupMode === mode
                    ? 'bg-text-primary text-white shadow-[0_8px_22px_rgba(15,23,42,0.14)]'
                    : 'text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {mode === 'identity' ? 'Identidad' : 'Plataforma'}
              </button>
            ))}
          </div>
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder={groupMode === 'identity' ? 'Buscar identidades...' : 'Buscar plataformas...'}
          />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4 lg:px-3">
          <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
            {groupMode === 'identity' ? 'Identidades' : 'Plataformas'}
          </div>
          {groupMode === 'platform' ? (
            platformSummaries.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-text-tertiary">No hay plataformas.</p>
            ) : (
              <ul className="space-y-0.5 animate-vault-morph">
                {platformSummaries.map((platform) => {
                  const selected = selectedPlatformName?.toLowerCase() === platform.name.toLowerCase()
                  return (
                    <li key={platform.name}>
                      <button
                        type="button"
                        onClick={() => onSelectPlatform(platform.name)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
                          selected ? 'bg-surface-active' : 'hover:bg-surface-hover'
                        }`}
                      >
                        <span className="truncate text-sm font-medium text-text-primary/90">
                          {platform.name}
                        </span>
                        <span className="text-xs tabular-nums text-text-tertiary">{platform.count}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )
          ) : visibleIdentities.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-text-tertiary">No hay identidades.</p>
          ) : (
            <ul className="space-y-0.5 animate-vault-morph">
              {visibleIdentities.map((identity) => {
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
                        <span className="block truncate text-sm font-medium text-text-primary/90">
                          {identity.email}
                        </span>
                      </button>
                      <span className="shrink-0 px-1 text-xs tabular-nums text-text-tertiary">
                        {identity.platforms.length}
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
              })}
            </ul>
          )}

          <div className="mt-5 px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
            Categorías locales
          </div>
          <ul className="space-y-0.5">
            {(Object.keys(LOCAL_ITEM_LABELS) as LocalVaultItemType[]).map((type) => {
              const selected = selectedLocalCategory === type
              const count = localItems.filter((item) => item.type === type).length
              return (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => onSelectLocalCategory(type)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
                      selected ? 'bg-surface-active' : 'hover:bg-surface-hover'
                    }`}
                  >
                    <span className="truncate text-sm font-medium text-text-primary/90">
                      {LOCAL_ITEM_LABELS[type]}
                    </span>
                    <span className="text-xs tabular-nums text-text-tertiary">{count}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {(!isMobile || (installPromptAvailable && onInstall)) && (
          <footer className="flex flex-col gap-2.5 border-t border-border-subtle bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              {!isMobile && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="rounded-lg border border-black/5 px-2 py-1 text-[10px] font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                >
                  Copia Local / TSV
                </button>
              )}

              {cloudUserEmail && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void syncActiveProfileToCloud()}
                    disabled={cloudSyncStatus === 'syncing'}
                    className="rounded-lg border border-black/5 px-2 py-1 text-[10px] font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                  >
                    Sincronizar
                  </button>
                  <button
                    type="button"
                    onClick={logoutCloud}
                    className="rounded-lg px-2 py-1 text-[10px] font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    Salir
                  </button>
                </div>
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
}

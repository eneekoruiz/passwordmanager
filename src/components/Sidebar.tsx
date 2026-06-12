import { useState, useEffect } from 'react'
import type { Platform } from '../types'
import { SearchBar } from './SearchBar'
import { useVault } from '../context/VaultContext'
import { PlatformLogo } from './ui/PlatformLogo'
import { POPULAR_SERVICES } from '../data/popularServices'

interface SidebarProps {
  platforms: Platform[]
  selectedId: string | null
  searchQuery: string
  onSearchChange: (query: string) => void
  onSelect: (id: string) => void
  onAddPlatform: (name: string) => Promise<void>
  onRenamePlatform: (id: string, name: string) => Promise<void>
  onDeletePlatform: (id: string) => Promise<void>
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
  platforms,
  selectedId,
  searchQuery,
  onSearchChange,
  onSelect,
  onAddPlatform,
  onRenamePlatform,
  onDeletePlatform,
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
  const [newPlatformName, setNewPlatformName] = useState('')
  const [adding, setAdding] = useState(false)

  // Autocomplete suggestions for popular services
  const suggestions = newPlatformName.trim()
    ? POPULAR_SERVICES.filter(service =>
        service.name.toLowerCase().includes(newPlatformName.toLowerCase()) ||
        service.domain.toLowerCase().includes(newPlatformName.toLowerCase())
      ).slice(0, 5)
    : []

  // Estados de conexión e indicador de sincronización iCloud
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showCheck, setShowCheck] = useState(false)

  useEffect(() => {
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
      const timer = setTimeout(() => {
        setShowCheck(false)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [cloudSyncStatus])

  // Estados para la edición de plataformas
  const [activeMenuPlatformId, setActiveMenuPlatformId] = useState<string | null>(null)
  const [editingPlatformId, setEditingPlatformId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleAddPlatform = async (nameToUse?: string) => {
    const name = (nameToUse || newPlatformName).trim()
    if (!name) return

    setAdding(true)
    try {
      await onAddPlatform(name)
      setNewPlatformName('')
      setShowAddForm(false)
    } finally {
      setAdding(false)
    }
  }

  const handleRename = async (id: string) => {
    const name = editName.trim()
    if (!name) return
    try {
      await onRenamePlatform(id, name)
      setEditingPlatformId(null)
    } catch {
      alert('No se pudo renombrar la plataforma.')
    }
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
            ? "flex flex-col w-full h-full bg-surface"
            : `
              fixed inset-y-0 left-0 z-30 flex w-full max-w-[320px] flex-col
              border-r border-border-subtle bg-surface
              transition-transform duration-300 ease-out
              lg:static lg:z-auto lg:max-w-none lg:w-72 lg:translate-x-0
              ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `
        }
        aria-label="Lista de plataformas"
      >
        <header className="flex items-center justify-between px-4 pt-4 pb-3 lg:px-5 lg:pt-5">
          <div className="flex flex-col text-left">
            <h1 className="text-base font-bold tracking-tight text-text-primary">
              Contras
            </h1>
            {profileName && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                  {profileName}
                </span>
                {cloudUserEmail && (
                  <div className="flex items-center justify-center shrink-0">
                    {!isOnline ? (
                      <svg className="h-3 w-3 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <title>Modo sin conexión</title>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                      </svg>
                    ) : cloudSyncStatus === 'syncing' ? (
                      <svg className="animate-spin h-3 w-3 text-blue-500" fill="none" viewBox="0 0 24 24">
                        <title>Sincronizando...</title>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : showCheck ? (
                      <svg className="h-3 w-3 text-green-500 animate-fade-in" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <title>Sincronizado</title>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : cloudSyncStatus === 'error' ? (
                      <svg className="h-3 w-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <title>Error de sincronización</title>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover"
              aria-label="Añadir plataforma"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            {!isMobile && (
              <>
                <button
                  type="button"
                  onClick={onLock}
                  className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover"
                  aria-label="Bloquear bóveda"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover lg:hidden"
                  onClick={onClose}
                  aria-label="Cerrar"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </header>

        {showAddForm && (
          <div className="px-4 pb-3 lg:px-5 relative z-50">
            <div className="flex gap-2">
              <input
                type="text"
                value={newPlatformName}
                onChange={(e) => setNewPlatformName(e.target.value)}
                placeholder="Nombre de plataforma"
                className="flex-1 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-border focus:ring-1 focus:ring-border/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddPlatform()
                }}
              />
              <button
                type="button"
                onClick={() => handleAddPlatform()}
                disabled={adding || !newPlatformName.trim()}
                className="rounded-lg bg-text-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {adding ? '…' : 'OK'}
              </button>
            </div>

            {/* Sugerencias Inteligentes Popover */}
            {suggestions.length > 0 && (
              <div className="absolute left-4 right-4 lg:left-5 lg:right-5 mt-1 rounded-xl border border-black/5 bg-white/95 backdrop-blur-md shadow-lg py-1 text-left">
                {suggestions.map((service) => (
                  <button
                    key={service.domain}
                    type="button"
                    onClick={() => handleAddPlatform(service.name)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-hover transition-colors"
                  >
                    <PlatformLogo name={service.name} className="h-4 w-4" />
                    <span>{service.name}</span>
                    <span className="text-[10px] text-text-tertiary font-mono">({service.domain})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="px-4 pb-3 lg:px-5">
          <SearchBar value={searchQuery} onChange={onSearchChange} />
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-4 lg:px-3">
          {platforms.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-text-tertiary">
              No hay plataformas. Pulsa + para añadir una.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {platforms.map((platform) => {
                const isSelected = platform.id === selectedId
                const isEditing = platform.id === editingPlatformId

                return (
                  <li key={platform.id} className="group relative">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 rounded-lg px-2 py-1 bg-surface-active">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-text-primary outline-none px-1 py-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(platform.id)
                            if (e.key === 'Escape') setEditingPlatformId(null)
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRename(platform.id)}
                          className="rounded p-1 text-text-primary hover:bg-surface-hover transition-colors"
                          aria-label="Guardar"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPlatformId(null)}
                          className="rounded p-1 text-text-secondary hover:bg-surface-hover transition-colors"
                          aria-label="Cancelar"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onSelect(platform.id)}
                          className={`
                            flex w-full items-center justify-between rounded-lg pl-3 pr-10 py-2.5 text-left transition-colors
                            ${isSelected ? 'bg-surface-active' : 'hover:bg-surface-hover'}
                          `}
                          aria-current={isSelected ? 'true' : undefined}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 mr-2">
                            <PlatformLogo name={platform.name} className="h-4.5 w-4.5" />
                            <span className="text-sm font-medium text-text-primary/90 truncate">
                              {platform.name}
                            </span>
                          </div>
                          {isMobile ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-xs text-text-tertiary tabular-nums">
                                {platform.accounts.length}
                              </span>
                              <svg className="h-3 w-3 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </div>
                          ) : (
                            <span className="text-xs text-text-tertiary tabular-nums shrink-0 group-hover:opacity-0 transition-opacity duration-150">
                              {platform.accounts.length}
                            </span>
                          )}
                        </button>

                        {/* Botón de opciones discretas en hover (siempre visible en móvil para pantallas táctiles) */}
                        <div className={`absolute right-2 top-1/2 -translate-y-1/2 items-center ${isMobile ? 'flex' : 'hidden group-hover:flex'}`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveMenuPlatformId(
                                activeMenuPlatformId === platform.id ? null : platform.id
                              )
                            }}
                            className={`rounded p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors ${
                              activeMenuPlatformId === platform.id ? 'bg-surface-active text-text-primary' : ''
                            }`}
                            aria-label="Opciones"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                            </svg>
                          </button>
                        </div>

                        {/* Menú contextual flotante de opciones */}
                        {activeMenuPlatformId === platform.id && (
                          <>
                            <button
                              type="button"
                              className="fixed inset-0 z-10 cursor-default outline-none"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveMenuPlatformId(null)
                              }}
                              aria-label="Cerrar opciones"
                            />
                            <div className="absolute right-2 top-8 z-20 w-28 rounded-lg border border-border-subtle bg-surface-elevated py-1 shadow-lg text-left">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingPlatformId(platform.id)
                                  setEditName(platform.name)
                                  setActiveMenuPlatformId(null)
                                }}
                                className="flex w-full items-center px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface-hover transition-colors"
                              >
                                Renombrar
                              </button>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  setActiveMenuPlatformId(null)
                                  if (
                                    confirm(
                                      `¿Seguro que deseas eliminar la plataforma "${platform.name}" y todas sus cuentas asociadas?`
                                    )
                                  ) {
                                    await onDeletePlatform(platform.id)
                                  }
                                }}
                                className="flex w-full items-center px-3 py-2 text-xs font-medium text-red-600 hover:bg-surface-hover transition-colors"
                              >
                                Eliminar
                              </button>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </nav>

        {(!isMobile || (installPromptAvailable && onInstall)) && (
          <footer className="border-t border-border-subtle p-3 bg-surface flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              {!isMobile && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary border border-black/5"
                >
                  Copia Local / TSV
                </button>
              )}

              {cloudUserEmail && (
                <div className="flex gap-1.5 items-center">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await syncActiveProfileToCloud()
                      } catch {
                        // status handled by context
                      }
                    }}
                    disabled={cloudSyncStatus === 'syncing'}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary border border-black/5"
                  >
                    Sincronizar ahora
                  </button>

                  <button
                    type="button"
                    onClick={logoutCloud}
                    className="rounded-lg px-2 py-1 text-[10px] font-semibold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>

            {installPromptAvailable && onInstall && (
              <button
                type="button"
                onClick={onInstall}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-text-primary py-2 text-xs font-semibold text-white hover:opacity-90 transition-all active:scale-[0.98] duration-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Instalar Contras App
              </button>
            )}
          </footer>
        )}
      </aside>
    </>
  )
}


import { useState, useEffect } from 'react'
import type { Account, Platform } from '../types'
import { useVault } from '../context/VaultContext'
import { AccountCard } from './AccountCard'
import { AccountForm } from './AccountForm'
import { EmptyState } from './EmptyState'
import { PlatformLogo } from './ui/PlatformLogo'

type ViewMode = 'list' | 'create' | 'edit'

interface MainAreaProps {
  platform: Platform | null
  onOpenSidebar: () => void
  onSelectPlatform: (id: string | null) => void
  onOpenImportText: () => void
  isMobile?: boolean
}

export function MainArea({
  platform,
  onOpenSidebar,
  onSelectPlatform,
  onOpenImportText,
  isMobile = false,
}: MainAreaProps) {
  const { platforms, addPlatform, addAccount, updateAccount, deleteAccount, cloudUserEmail, cloudSyncStatus } = useVault()
  const [view, setView] = useState<ViewMode>('list')
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  
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

  // Estados para creación del primer perfil/plataforma
  const [showFirstPlatformInput, setShowFirstPlatformInput] = useState(false)
  const [firstPlatformName, setFirstPlatformName] = useState('')
  const [creating, setCreating] = useState(false)

  const resetView = () => {
    setView('list')
    setEditingAccount(null)
  }

  // Si no hay ninguna plataforma en todo el perfil activo, mostrar EmptyState con onboarding
  if (platforms.length === 0) {
    return (
      <div className="flex flex-1 flex-col justify-center bg-surface-elevated">
        {showFirstPlatformInput ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-md mx-auto animate-fade-in select-none">
            <div className="h-16 w-16 rounded-2xl bg-surface flex items-center justify-center text-text-secondary border border-border-subtle shadow-sm mb-6 animate-pulse">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-text-primary mb-2">Crear tu primera plataforma</h3>
            <p className="text-xs text-text-secondary leading-relaxed mb-6">
              Introduce el nombre de la plataforma (ej. Google, Netflix, Banco) para comenzar a organizar tus cuentas.
            </p>
            <div className="w-full flex flex-col gap-3">
              <input
                type="text"
                value={firstPlatformName}
                onChange={(e) => setFirstPlatformName(e.target.value)}
                placeholder="Nombre de la plataforma"
                className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-xs text-text-primary outline-none focus:border-border transition-colors font-medium text-center"
                autoFocus
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && firstPlatformName.trim() && !creating) {
                    const name = firstPlatformName.trim()
                    setCreating(true)
                    try {
                      const newPlat = await addPlatform(name)
                      onSelectPlatform(newPlat.id)
                      setShowFirstPlatformInput(false)
                      setFirstPlatformName('')
                    } finally {
                      setCreating(false)
                    }
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowFirstPlatformInput(false)
                    setFirstPlatformName('')
                  }}
                  className="flex-1 rounded-xl border border-border bg-surface hover:bg-surface-hover py-3 text-xs font-semibold text-text-primary transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const name = firstPlatformName.trim()
                    if (!name) return
                    setCreating(true)
                    try {
                      const newPlat = await addPlatform(name)
                      onSelectPlatform(newPlat.id)
                      setShowFirstPlatformInput(false)
                      setFirstPlatformName('')
                    } finally {
                      setCreating(false)
                    }
                  }}
                  disabled={creating || !firstPlatformName.trim()}
                  className="flex-1 rounded-xl bg-text-primary hover:opacity-90 py-3 text-xs font-semibold text-white disabled:opacity-50 transition-opacity"
                >
                  {creating ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            onAddPassword={() => setShowFirstPlatformInput(true)}
            onImportText={onOpenImportText}
          />
        )}
      </div>
    )
  }

  if (!platform) {
    return (
      <div className="flex flex-1 flex-col">
        {!isMobile && (
          <header className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 lg:hidden">
            <button
              type="button"
              onClick={onOpenSidebar}
              className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover"
              aria-label="Abrir lista de plataformas"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm font-medium text-text-secondary">Contras</span>
          </header>
        )}

        <div className="flex flex-1 items-center justify-center px-6">
          <div className="text-center">
            <p className="text-sm text-text-secondary">Selecciona una plataforma</p>
            <p className="mt-1 text-xs text-text-tertiary">
              o crea una nueva desde el panel lateral
            </p>
          </div>
        </div>
      </div>
    )
  }

  const isFormView = view === 'create' || view === 'edit'

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 lg:px-8 lg:py-5">
        {isMobile ? (
          <button
            type="button"
            onClick={() => onSelectPlatform(null)}
            className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover"
            aria-label="Volver a la lista de plataformas"
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
            aria-label="Abrir lista de plataformas"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <div className="flex-1 min-w-0 flex items-center gap-3">
          {!isFormView && platform && (
            <PlatformLogo name={platform.name} className="h-8 w-8" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight text-text-primary truncate">
              {isFormView
                ? view === 'create'
                  ? 'Nueva cuenta'
                  : 'Editar cuenta'
                : platform?.name}
            </h2>
            {!isFormView && platform && (
              <p className="text-xs text-text-tertiary mt-0.5">
                {platform.accounts.length} cuenta
                {platform.accounts.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {!isFormView && (
          <div className="flex items-center gap-3">
            {cloudUserEmail && (
              <div className="flex items-center justify-center shrink-0">
                {!isOnline ? (
                  <svg className="h-3.5 w-3.5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <title>Modo sin conexión</title>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                  </svg>
                ) : cloudSyncStatus === 'syncing' ? (
                  <svg className="animate-spin h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <title>Sincronizando...</title>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : showCheck ? (
                  <svg className="h-3.5 w-3.5 text-green-500 animate-fade-in" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <title>Sincronizado</title>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : null}
              </div>
            )}
            <button
              type="button"
              onClick={() => setView('create')}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-sm font-medium text-text-primary shadow-subtle transition-colors hover:bg-surface-hover"
              aria-label="Añadir cuenta"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="hidden sm:inline">Añadir</span>
            </button>
          </div>
        )}

        {isFormView && (
          <button
            type="button"
            onClick={resetView}
            className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover"
          >
            Volver
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 lg:px-8 lg:py-6">
        {view === 'list' && (
          <>
            {platform.accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-text-secondary">Sin cuentas todavía</p>
                <button
                  type="button"
                  onClick={() => setView('create')}
                  className="mt-3 text-sm font-medium text-text-primary underline-offset-2 hover:underline"
                >
                  Añadir la primera cuenta
                </button>
              </div>
            ) : (
              <ul className="space-y-3 max-w-2xl">
                {platform.accounts.map((account) => (
                  <li key={account.id}>
                    <AccountCard
                      account={account}
                      onEdit={() => {
                        setEditingAccount(account)
                        setView('edit')
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {view === 'create' && (
          <AccountForm
            mode="create"
            onSave={async (account) => {
              await addAccount(platform.id, account)
              resetView()
            }}
            onCancel={resetView}
          />
        )}

        {view === 'edit' && editingAccount && (
          <AccountForm
            mode="edit"
            initialAccount={editingAccount}
            onSave={async (account) => {
              await updateAccount(platform.id, editingAccount.id, account)
              resetView()
            }}
            onCancel={resetView}
            onDelete={async () => {
              await deleteAccount(platform.id, editingAccount.id)
              resetView()
            }}
          />
        )}
      </div>
    </div>
  )
}

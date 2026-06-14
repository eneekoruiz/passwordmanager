import { useState } from 'react'
import type { Identity, Platform } from '../types'
import { createPlatform } from '../utils/identity'
import { AccountForm } from './AccountForm'
import { EmptyState } from './EmptyState'
import { PlatformLogo } from './ui/PlatformLogo'

type ViewMode = 'grid' | 'create' | 'edit'

interface MainAreaProps {
  identity: Identity | null
  onOpenSidebar: () => void
  onSelectIdentity: (id: string | null) => void
  onOpenImportText: () => void
  onAddPlatform: (identityId: string, platform: Platform) => Promise<void>
  onUpdatePlatform: (identityId: string, platformId: string, platform: Platform) => Promise<void>
  onDeletePlatform: (identityId: string, platformId: string) => Promise<void>
  isMobile?: boolean
}

export function MainArea({
  identity,
  onOpenSidebar,
  onSelectIdentity,
  onOpenImportText,
  onAddPlatform,
  onUpdatePlatform,
  onDeletePlatform,
  isMobile = false,
}: MainAreaProps) {
  const [view, setView] = useState<ViewMode>('grid')
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null)

  const resetView = () => {
    setView('grid')
    setEditingPlatform(null)
  }

  if (!identity) {
    return (
      <div className="flex flex-1 flex-col">
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
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <p className="text-sm text-text-secondary">Selecciona una identidad</p>
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
            onClick={() => onSelectIdentity(null)}
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

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-text-primary">
            {isFormView ? (view === 'create' ? 'Nueva plataforma' : editingPlatform?.name) : identity.email}
          </h2>
          {!isFormView && (
            <p className="mt-0.5 text-xs text-text-tertiary">
              {identity.platforms.length} plataforma{identity.platforms.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {isFormView ? (
          <button
            type="button"
            onClick={resetView}
            className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover"
          >
            Volver
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditingPlatform(createPlatform('', { username: identity.email }))
              setView('create')
            }}
            className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-sm font-medium text-text-primary shadow-subtle transition-colors hover:bg-surface-hover"
          >
            Añadir
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6">
        {view === 'grid' && (
          <>
            {identity.platforms.length === 0 ? (
              <EmptyState
                onAddPassword={() => {
                  setEditingPlatform(createPlatform('', { username: identity.email }))
                  setView('create')
                }}
                onImportText={onOpenImportText}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {identity.platforms.map((platform) => (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => {
                      setEditingPlatform(platform)
                      setView('edit')
                    }}
                    className="flex min-h-[96px] items-start gap-3 rounded-lg border border-border-subtle bg-white p-4 text-left shadow-subtle transition-colors hover:bg-surface-hover"
                  >
                    <PlatformLogo name={platform.name} className="h-9 w-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text-primary">
                        {platform.name}
                      </span>
                      <span className="mt-1 block truncate text-xs text-text-secondary">
                        {platform.username || identity.email}
                      </span>
                      <span className="mt-3 flex flex-wrap gap-1.5">
                        {platform.linkedGoogleAccount && (
                          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                            Google
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
            identityEmail={identity.email}
            initialAccount={editingPlatform}
            onSave={async (platform) => {
              await onAddPlatform(identity.id, platform)
              resetView()
            }}
            onCancel={resetView}
          />
        )}

        {view === 'edit' && editingPlatform && (
          <AccountForm
            mode="edit"
            identityEmail={identity.email}
            initialAccount={editingPlatform}
            onSave={async (platform) => {
              await onUpdatePlatform(identity.id, editingPlatform.id, platform)
              resetView()
            }}
            onCancel={resetView}
            onDelete={async () => {
              await onDeletePlatform(identity.id, editingPlatform.id)
              resetView()
            }}
          />
        )}
      </div>
    </div>
  )
}

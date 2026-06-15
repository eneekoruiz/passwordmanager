import { useState } from 'react'
import type { Identity, LocalVaultItem, LocalVaultItemType, Platform } from '../types'
import { createPlatform } from '../utils/identity'
import { createLocalVaultItem, LOCAL_ITEM_LABELS, vaultItemDisplayName } from '../utils/vaultItem'
import { AccountForm } from './AccountForm'
import { EmptyState } from './EmptyState'
import { PlatformLogo } from './ui/PlatformLogo'
import { VaultItemForm } from './VaultItemForm'

type ViewMode = 'grid' | 'create' | 'edit'

interface MainAreaProps {
  identity: Identity | null
  localCategory: LocalVaultItemType | null
  localItems: LocalVaultItem[]
  onOpenSidebar: () => void
  onSelectIdentity: (id: string | null) => void
  onSelectLocalCategory: (type: LocalVaultItemType) => void
  onOpenImportText: () => void
  onAddPlatform: (identityId: string, platform: Platform) => Promise<void>
  onUpdatePlatform: (identityId: string, platformId: string, platform: Platform) => Promise<void>
  onDeletePlatform: (identityId: string, platformId: string) => Promise<void>
  onSaveLocalItem: (item: LocalVaultItem) => Promise<void>
  onDeleteLocalItem: (itemId: string) => Promise<void>
  isMobile?: boolean
}

export function MainArea({
  identity,
  localCategory,
  localItems,
  onOpenSidebar,
  onSelectIdentity,
  onSelectLocalCategory,
  onOpenImportText,
  onAddPlatform,
  onUpdatePlatform,
  onDeletePlatform,
  onSaveLocalItem,
  onDeleteLocalItem,
  isMobile = false,
}: MainAreaProps) {
  const [view, setView] = useState<ViewMode>('grid')
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null)
  const [editingLocalItem, setEditingLocalItem] = useState<LocalVaultItem | null>(null)

  const resetView = () => {
    setView('grid')
    setEditingPlatform(null)
    setEditingLocalItem(null)
  }

  if (!identity && !localCategory) {
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
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-2xl text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">Tipo de Secreto</p>
            <h2 className="mt-2 text-xl font-bold text-text-primary">Elige qué quieres guardar</h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-text-secondary">
              Las cuentas online se organizan por identidad. El resto vive en categorías locales cifradas.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(Object.keys(LOCAL_ITEM_LABELS) as LocalVaultItemType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onSelectLocalCategory(type)}
                  className="rounded-2xl border border-border-subtle bg-white p-5 text-left shadow-subtle transition-colors hover:bg-surface-hover"
                >
                  <span className="block text-sm font-bold text-text-primary">{LOCAL_ITEM_LABELS[type]}</span>
                  <span className="mt-1 block text-xs text-text-secondary">Formulario dinámico con solo los campos necesarios.</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isFormView = view === 'create' || view === 'edit'
  const selectedLocalItems = localCategory
    ? localItems.filter((item) => item.type === localCategory)
    : []

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
            {isFormView
              ? view === 'create'
                ? localCategory
                  ? `Nuevo ${LOCAL_ITEM_LABELS[localCategory]}`
                  : 'Nueva plataforma'
                : editingPlatform?.name ?? editingLocalItem?.title
              : localCategory
                ? LOCAL_ITEM_LABELS[localCategory]
                : identity?.email}
          </h2>
          {!isFormView && (
            <p className="mt-0.5 text-xs text-text-tertiary">
              {localCategory
                ? `${selectedLocalItems.length} secreto${selectedLocalItems.length !== 1 ? 's' : ''}`
                : `${identity?.platforms.length ?? 0} plataforma${identity?.platforms.length !== 1 ? 's' : ''}`}
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
              if (localCategory) {
                setEditingLocalItem(createLocalVaultItem(localCategory))
              } else if (identity) {
                setEditingPlatform(createPlatform('', { username: identity.email }))
              }
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
            {localCategory ? (
              selectedLocalItems.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-white/70 px-6 text-center">
                  <p className="text-sm font-semibold text-text-primary">Sin secretos en {LOCAL_ITEM_LABELS[localCategory]}</p>
                  <p className="mt-1 max-w-sm text-xs text-text-secondary">Crea el primer registro. Se cifrará localmente antes de sincronizarse con Firebase.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLocalItem(createLocalVaultItem(localCategory))
                      setView('create')
                    }}
                    className="mt-4 rounded-xl bg-text-primary px-4 py-2 text-xs font-semibold text-white"
                  >
                    Crear secreto
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {selectedLocalItems.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setEditingLocalItem(item)
                        setView('edit')
                      }}
                      style={{ animationDelay: `${index * 45}ms` }}
                      className="animate-vault-slide-up min-h-[96px] rounded-xl border border-black/[0.06] bg-white/85 p-4 text-left shadow-[0_10px_30px_rgba(0,0,0,0.025)] backdrop-blur transition-all duration-150 hover:-translate-y-0.5 hover:border-black/10 hover:bg-white hover:shadow-[0_18px_45px_rgba(0,0,0,0.055)] active:scale-[0.98]"
                    >
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
            ) : identity && identity.platforms.length === 0 ? (
              <EmptyState
                onAddPassword={() => {
                  setEditingPlatform(createPlatform('', { username: identity.email }))
                  setView('create')
                }}
                onImportText={onOpenImportText}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {identity?.platforms.map((platform, index) => (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => {
                      setEditingPlatform(platform)
                      setView('edit')
                    }}
                    style={{ animationDelay: `${index * 45}ms` }}
                    className="animate-vault-slide-up flex min-h-[104px] items-start gap-3 rounded-xl border border-black/[0.06] bg-white/85 p-4 text-left shadow-[0_10px_30px_rgba(0,0,0,0.025)] backdrop-blur transition-all duration-150 hover:-translate-y-0.5 hover:border-black/10 hover:bg-white hover:shadow-[0_18px_45px_rgba(0,0,0,0.055)] active:scale-[0.98]"
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
                        {platform.accessMethods
                          .filter((method) => method.type === 'SSO')
                          .map((method) => (
                          <span key={method.id} className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                            {method.provider}
                          </span>
                          ))}
                        {platform.accessMethods.some((method) => method.type === 'PASSKEY') && (
                          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                            Passkey
                          </span>
                        )}
                        {platform.accessMethods.some((method) => method.type === 'MAGIC_LINK') && (
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

        {view === 'create' && identity && editingPlatform && (
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

        {view === 'edit' && identity && editingPlatform && (
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

        {view === 'create' && editingLocalItem && (
          <VaultItemForm
            item={editingLocalItem}
            onSave={async (item) => {
              await onSaveLocalItem(item)
              resetView()
            }}
            onCancel={resetView}
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
            onDelete={async () => {
              await onDeleteLocalItem(editingLocalItem.id)
              resetView()
            }}
          />
        )}
      </div>
    </div>
  )
}

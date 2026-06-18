import { useEffect, useMemo, useState } from 'react'
import type { Identity, LocalCategory, LocalVaultItem, Platform, VaultGroupMode } from '../types'
import { createPlatform } from '../utils/identity'
import { createLocalVaultItem, LOCAL_ITEM_LABELS, vaultItemDisplayName } from '../utils/vaultItem'
import { AccountForm, type UnsavedFormActions } from './AccountForm'
import { EmptyState } from './EmptyState'
import { PlatformLogo } from './ui/PlatformLogo'
import { VaultItemForm } from './VaultItemForm'

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
  onSelectPlatformName: (platformName: string) => void
  onSelectLocalCategory: (category: LocalCategory) => void
  onOpenImportText: () => void
  onAddPlatform: (identityId: string, platform: Platform) => Promise<void>
  onUpdatePlatform: (identityId: string, platformId: string, platform: Platform) => Promise<void>
  onDeletePlatform: (identityId: string, platformId: string) => Promise<void>
  onSaveLocalItem: (item: LocalVaultItem) => Promise<void>
  onDeleteLocalItem: (itemId: string) => Promise<void>
  isMobile?: boolean
  createTrigger?: number
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

export function MainArea({
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
  /* onSelectLocalCategory */
  onOpenImportText,
  onAddPlatform,
  onUpdatePlatform,
  onDeletePlatform,
  onSaveLocalItem,
  onDeleteLocalItem,
  isMobile = false,
  createTrigger = 0,
}: MainAreaProps) {
  const [view, setView] = useState<ViewMode>('grid')
  const [editingPlatform, setEditingPlatform] = useState<EditingPlatformContext | null>(null)
  const [editingLocalItem, setEditingLocalItem] = useState<LocalVaultItem | null>(null)

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
          platform: createPlatform('', { username: targetIdentity.email }),
        })
        setView('create')
      }
    }
  }, [createTrigger])

  const platformAccounts = useMemo<PlatformAccount[]>(() => {
    if (groupMode !== 'platform' || !selectedPlatformName) return []
    const target = selectedPlatformName.trim().toLowerCase()
    return identities.flatMap((item) =>
      item.platforms
        .filter((platform) => platform.name.trim().toLowerCase() === target)
        .map((platform) => ({
          identityId: item.id,
          identityEmail: item.email,
          platform,
        })),
    )
  }, [groupMode, identities, selectedPlatformName])

  const selectedPlatformDisplayName = platformAccounts[0]?.platform.name ?? selectedPlatformName
  const hasVaultSelection = Boolean(identity || localCategory || selectedPlatformName)
  const featuredPlatforms = useMemo<PlatformQuickPick[]>(() => {
    const counts = new Map<string, number>()
    identities.forEach((item) => {
      item.platforms.forEach((platform) => {
        const name = platform.name.trim()
        if (!name) return
        const existing = [...counts.keys()].find((key) => key.toLowerCase() === name.toLowerCase())
        if (existing) counts.set(existing, (counts.get(existing) ?? 0) + 1)
        else counts.set(name, 1)
      })
    })
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 8)
  }, [identities])

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
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-5xl">
            <div className="rounded-[28px] border border-black/[0.06] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.96),_rgba(248,250,252,0.92)_46%,_rgba(241,245,249,0.94))] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur xl:p-8">
              <div className="grid gap-6">
                <section className="space-y-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">
                      {groupMode === 'platform' ? 'Vista por plataforma' : 'Tus Identidades'}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
                      {groupMode === 'platform' ? 'Explora tus accesos con una vista visual' : 'Gestiona tus cuentas por identidad'}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
                      {groupMode === 'platform'
                        ? 'Selecciona una plataforma para ver todas las cuentas relacionadas, comparar accesos y entrar a editar sin perder contexto.'
                        : 'Selecciona una identidad para ver todas las plataformas y cuentas vinculadas a ese correo o perfil.'}
                    </p>
                  </div>

                  {groupMode === 'platform' ? (
                    featuredPlatforms.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {featuredPlatforms.map((platform, index) => (
                          <button
                            key={platform.name}
                            type="button"
                            onClick={() => onRequestNavigation(() => onSelectPlatformName(platform.name))}
                            className="animate-vault-slide-up flex items-center gap-4 rounded-2xl border border-black/[0.06] bg-white/80 p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-0.5 hover:border-black/10 hover:bg-white"
                            style={{ animationDelay: `${index * 40}ms` }}
                          >
                            <PlatformLogo name={platform.name} className="h-11 w-11 rounded-2xl border border-black/[0.05] bg-white p-1 shadow-sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-text-primary">{platform.name}</span>
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
                      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface-subtle py-12 text-center">
                        <h3 className="text-base font-bold text-text-primary">No hay plataformas</h3>
                        <p className="mt-1 max-w-sm text-sm text-text-secondary">Crea cuentas en tus identidades y aparecerán aquí agrupadas por plataforma.</p>
                      </div>
                    )
                  ) : identities.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {identities.map((idItem, index) => (
                        <button
                          key={idItem.id}
                          type="button"
                          onClick={() => onRequestNavigation(() => onSelectIdentity(idItem.id))}
                          className="animate-vault-slide-up flex items-center gap-4 rounded-2xl border border-black/[0.06] bg-white/80 p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-0.5 hover:border-black/10 hover:bg-white"
                          style={{ animationDelay: `${index * 40}ms` }}
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 font-bold text-text-primary ring-1 ring-black/5">
                            {idItem.email.charAt(0).toUpperCase()}
                          </div>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-text-primary">{idItem.email}</span>
                            <span className="mt-1 block text-xs text-text-secondary">
                              {idItem.platforms.length} plataforma{idItem.platforms.length !== 1 ? 's' : ''} vinculada{idItem.platforms.length !== 1 ? 's' : ''}
                            </span>
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-text-secondary">
                            Abrir
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface-subtle py-12 text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
                        <svg className="h-6 w-6 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </div>
                      <h3 className="text-base font-bold text-text-primary">No tienes identidades creadas</h3>
                      <p className="mt-1 max-w-sm text-sm text-text-secondary">Utiliza el botón en la barra lateral para crear tu primera identidad (ej. tu email personal o de trabajo).</p>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isFormView = view === 'create' || view === 'edit'
  const selectedLocalItems = localCategory
    ? localItems.filter((item) => (item.categoryId ?? item.type) === localCategory.id)
    : []

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border-subtle bg-white/72 px-4 py-3 shadow-sm backdrop-blur-xl lg:px-8 lg:py-5">
        {isMobile ? (
          <button
            type="button"
            onClick={() => onRequestNavigation(() => onSelectIdentity(null))}
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
          {isFormView && identity && (
            <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full border border-black/[0.06] bg-white/85 px-3 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
              <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                Identidad activa
              </span>
              <span className="truncate text-xs font-semibold text-text-primary">
                {identity.email}
              </span>
            </div>
          )}
          <h2 className="truncate text-lg font-semibold text-text-primary">
            {isFormView
              ? view === 'create'
                ? localCategory
                  ? `Nuevo ${localCategory.label}`
                  : 'Nueva plataforma'
                : editingPlatform?.platform.name ?? editingLocalItem?.title
              : localCategory
                ? localCategory.label
                : groupMode === 'platform'
                  ? selectedPlatformDisplayName
                  : identity?.email}
          </h2>
          <p className="mt-0.5 truncate text-xs text-text-tertiary">
            {isFormView
              ? localCategory
                ? localCategory.label
                : identity?.email
              : localCategory
                ? `${selectedLocalItems.length} secreto${selectedLocalItems.length !== 1 ? 's' : ''}`
                : groupMode === 'platform'
                  ? `${platformAccounts.length} cuenta${platformAccounts.length !== 1 ? 's' : ''} en esta plataforma`
                  : `${identity?.platforms.length ?? 0} plataforma${identity?.platforms.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {isFormView ? (
          <button
            type="button"
            onClick={() => onRequestNavigation(resetView)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover"
          >
            Volver
          </button>
        ) : (groupMode === 'platform' && !localCategory) ? null : (
          <button
            type="button"
            onClick={() => {
              if (localCategory) {
                setEditingLocalItem(createLocalVaultItem(localCategory.type, localCategory.id, localCategory.label))
              } else if (identity) {
                setEditingPlatform({
                  identityId: identity.id,
                  identityEmail: identity.email,
                  platform: createPlatform('', { username: identity.email }),
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

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:overflow-y-auto lg:px-8 lg:py-6">
        {view === 'grid' && (
          <>
            {localCategory ? (
              selectedLocalItems.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-white/70 px-6 text-center">
                  <p className="text-sm font-semibold text-text-primary">Sin secretos en {localCategory.label}</p>
                  <p className="mt-1 max-w-sm text-xs text-text-secondary">Crea el primer registro. Se cifrará localmente antes de sincronizarse con Firebase.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLocalItem(createLocalVaultItem(localCategory.type, localCategory.id, localCategory.label))
                      setView('create')
                    }}
                    className="mt-4 rounded-xl bg-text-primary px-4 py-2 text-xs font-semibold text-white"
                  >
                    Crear secreto
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {selectedLocalItems.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setEditingLocalItem(item)
                        setView('edit')
                      }}
                      style={{ animationDelay: `${index * 45}ms` }}
                      className="animate-vault-slide-up relative min-h-[106px] overflow-hidden rounded-2xl border border-black/[0.06] bg-gradient-to-b from-white via-white to-slate-50/90 p-4 text-left shadow-[0_18px_55px_rgba(15,23,42,0.05)] backdrop-blur transition-all duration-150 hover:-translate-y-1 hover:border-black/10 hover:shadow-[0_24px_70px_rgba(15,23,42,0.08)] active:scale-[0.98]"
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
              platformAccounts.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-white/70 px-6 text-center animate-vault-morph">
                  <p className="text-sm font-semibold text-text-primary">No hay cuentas para {selectedPlatformName}</p>
                  <p className="mt-1 max-w-sm text-xs text-text-secondary">Cambia a la vista por identidad para crear una nueva cuenta desde su correo propietario.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {platformAccounts.map(({ identityId, identityEmail, platform }, index) => (
                    <button
                      key={`${identityId}-${platform.id}`}
                      type="button"
                      onClick={() => {
                        setEditingPlatform({ identityId, identityEmail, platform })
                        setView('edit')
                      }}
                      style={{ animationDelay: `${index * 45}ms` }}
                      className="animate-vault-slide-up relative flex min-h-[112px] items-start gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-gradient-to-b from-white via-white to-slate-50/90 p-4 text-left shadow-[0_18px_55px_rgba(15,23,42,0.05)] backdrop-blur transition-all duration-150 hover:-translate-y-1 hover:border-black/10 hover:shadow-[0_24px_70px_rgba(15,23,42,0.08)] active:scale-[0.98]"
                    >
                      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
                      <PlatformLogo name={platform.name} className="h-9 w-9" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-text-primary">
                          {platform.username || identityEmail}
                        </span>
                        <span className="mt-1 block truncate text-xs text-text-secondary">
                          {identityEmail}
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
                          {platform.twoFactorAuth && (
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
            ) : identity && identity.platforms.length === 0 ? (
              <EmptyState
                onAddPassword={() => {
                  setEditingPlatform({
                    identityId: identity.id,
                    identityEmail: identity.email,
                    platform: createPlatform('', { username: identity.email }),
                  })
                  setView('create')
                }}
                onImportText={onOpenImportText}
              />
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {identity?.platforms.map((platform, index) => (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => {
                      setEditingPlatform({
                        identityId: identity.id,
                        identityEmail: identity.email,
                        platform,
                      })
                      setView('edit')
                    }}
                    style={{ animationDelay: `${index * 45}ms` }}
                    className="animate-vault-slide-up relative flex min-h-[112px] items-start gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-gradient-to-b from-white via-white to-slate-50/90 p-4 text-left shadow-[0_18px_55px_rgba(15,23,42,0.05)] backdrop-blur transition-all duration-150 hover:-translate-y-1 hover:border-black/10 hover:shadow-[0_24px_70px_rgba(15,23,42,0.08)] active:scale-[0.98]"
                  >
                    <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
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
            onSave={async (platform) => {
              await onUpdatePlatform(editingPlatform.identityId, editingPlatform.platform.id, platform)
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

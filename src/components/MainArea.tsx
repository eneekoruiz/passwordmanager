import { useEffect, useMemo, useState, memo, useRef } from 'react'
import type { Identity, LocalCategory, LocalVaultItem, Platform, VaultGroupMode, SortMode } from '../types'
import { createPlatform } from '../utils/identity'
import { createLocalVaultItem, LOCAL_ITEM_LABELS, vaultItemDisplayName } from '../utils/vaultItem'
import { hasWeakPassword, hasExposedPassword } from '../utils/security'
import { AccountForm, type UnsavedFormActions } from './AccountForm'
import { EmptyState } from './EmptyState'
import { PlatformLogo } from './ui/PlatformLogo'
import { VaultItemForm } from './VaultItemForm'
import { getCanonicalPlatformName } from '../utils/platformUtils'
import { WeakPasswordWarningPopover } from './ui/WeakPasswordWarningPopover'
import { ExposedPasswordWarningPopover } from './ui/ExposedPasswordWarningPopover'
import { ShareModal, type SharePayload } from './ShareModal'
import { AlphabetScroller } from './AlphabetScroller'
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
  onVerifyMasterPassword?: (pw: string) => Promise<boolean>
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
  onVerifyMasterPassword,
}: MainAreaProps) {
  const [view, setView] = useState<ViewMode>('grid')
  const [editingPlatform, setEditingPlatform] = useState<EditingPlatformContext | null>(null)
  const [editingLocalItem, setEditingLocalItem] = useState<LocalVaultItem | null>(null)
  const [showShareModal, setShowShareModal] = useState<SharePayload | null>(null)
  const [quickTravelCopied, setQuickTravelCopied] = useState<string | null>(null)
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set())
  const [authVerifiedFor, setAuthVerifiedFor] = useState<Set<string>>(new Set())
  
  const [securityModalOpen, setSecurityModalOpen] = useState(false)
  const [securityPassword, setSecurityPassword] = useState('')
  const [securityError, setSecurityError] = useState<string | null>(null)
  const [pendingSecurityAction, setPendingSecurityAction] = useState<{ action: () => void, key: string } | null>(null)
  const [testPasswordModalOpen, setTestPasswordModalOpen] = useState<{ identityId: string, platform: Platform } | null>(null)

  const handleRequireAuth = (action: () => void, key: string) => {
    if (authVerifiedFor.has(key)) {
      action()
      return
    }
    setPendingSecurityAction({ action, key })
    setSecurityModalOpen(true)
  }
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

  const isFormView = view === 'create' || view === 'edit'
  const itemQuery = searchQuery.trim().toLowerCase()
  const selectedLocalItems = localCategory
    ? localItems.filter((item) => (item.categoryId ?? item.type) === localCategory.id)
    : []
  const filteredLocalItems = selectedLocalItems.filter((item) => {
    if (!itemQuery) return true
    return [vaultItemDisplayName(item), item.title, ...(item.tags || [])]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(itemQuery))
  })
  const filteredPlatformAccounts = platformAccounts.filter(({ identityEmail, platform }) => {
    if (!itemQuery) return true
    return [identityEmail, platform.name, platform.username, platform.notes, ...(platform.tags || [])]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(itemQuery))
  })
  const identityPlatforms = (identity?.platforms || [])
    .filter((platform) => {
      if (!itemQuery) return true
      return [platform.name, platform.username, platform.notes, ...(platform.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(itemQuery))
    })
    .sort((a, b) => {
      if (sortMode === 'alpha-asc') return a.name.localeCompare(b.name)
      if (sortMode === 'alpha-desc') return b.name.localeCompare(a.name)
      if (sortMode === 'created-desc') return (b.createdAt || '').localeCompare(a.createdAt || '')
      if (sortMode === 'created-asc') return (a.createdAt || '').localeCompare(b.createdAt || '')
      if (sortMode === 'access-desc') return (b.lastAccessedAt || '').localeCompare(a.lastAccessedAt || '')
      if (sortMode === 'usage-desc') return (b.accessCount || 0) - (a.accessCount || 0)
      return 0
    })

  const availableLetters = useMemo(() => {
    if ((sortMode !== 'alpha-asc' && sortMode !== 'alpha-desc') || isFormView || itemQuery) return []
    if (groupMode === 'identity' && identityPlatforms.length > 0) {
      const letters = Array.from(new Set(identityPlatforms.map(p => p.name.charAt(0).toUpperCase()).filter(c => /[A-Z]/.test(c))))
      return sortMode === 'alpha-desc' ? letters.sort((a, b) => b.localeCompare(a)) : letters.sort((a, b) => a.localeCompare(b))
    }
    return []
  }, [identityPlatforms, sortMode, isFormView, groupMode, itemQuery])

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleLetterSelect = (letter: string) => {
    const el = document.getElementById(`letter-${letter}`)
    if (el && scrollContainerRef.current) {
      // scroll Into view smoothly but correctly offset
      scrollContainerRef.current.scrollTo({
        top: el.offsetTop - 80, // offset header
        behavior: 'smooth'
      })
    }
  }

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
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-white/72 px-6 text-center shadow-[0_18px_55px_rgba(15,23,42,0.04)] animate-vault-morph dark:border-[#2c2c2e] dark:bg-slate-800/50">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-text-secondary shadow-sm ring-1 ring-black/5 dark:bg-slate-700 dark:text-slate-300 dark:ring-white/10">
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
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border-subtle dark:border-white/10 pb-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">
                        {groupMode === 'platform' ? 'Vista por plataforma' : groupMode === 'local' ? 'Bóveda Local' : 'Tus Identidades'}
                      </p>
                      <h2 className="mt-1 text-2xl font-black tracking-tight text-text-primary dark:text-white">
                        {groupMode === 'platform' ? 'Explora tus accesos con la vista visual' : groupMode === 'local' ? 'Gestiona tus notas y secretos locales' : 'Gestiona tus cuentas por identidad'}
                      </h2>
                      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-secondary dark:text-[#a0a0a5]">
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
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-black dark:bg-white dark:text-black px-4 text-xs font-bold text-white shadow-sm transition-transform hover:scale-[1.03] active:scale-95 self-start md:self-center"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Crear {groupMode === 'platform' ? 'cuenta' : groupMode === 'local' ? 'secreto local' : 'identidad'}
                    </button>
                  </div>
                  {isMobile && groupMode === 'platform' && (
                    <div className="mt-4 flex items-center gap-3 border-t border-border-subtle dark:border-white/10 pt-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Plataformas</span>
                        <span className="text-sm font-semibold text-text-primary dark:text-white">{featuredPlatforms.length}</span>
                      </div>
                      <div className="h-6 w-px bg-black/[0.04] dark:bg-white/10"></div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Cuentas</span>
                        <span className="text-sm font-semibold text-text-primary dark:text-white">{identities.reduce((sum, id) => sum + (id.platforms?.length || 0), 0)}</span>
                      </div>
                    </div>
                  )}

                  {groupMode === 'platform' ? (
                    featuredPlatforms.length > 0 ? (
                      <div className="space-y-6">
                        {(sortMode === 'alpha-asc' || sortMode === 'alpha-desc' ? Array.from(
                          featuredPlatforms.reduce((acc, platform) => {
                            const first = platform.name[0]?.toUpperCase() ?? '#'
                            const letter = /^[A-Z]/.test(first) ? first : '#'
                            if (!acc.has(letter)) acc.set(letter, [])
                            acc.get(letter)!.push(platform)
                            return acc
                          }, new Map<string, typeof featuredPlatforms>())
                        ).sort(([a], [b]) => sortMode === 'alpha-asc' ? a.localeCompare(b) : b.localeCompare(a)) : [['', featuredPlatforms]] as const).map(([letter, platforms]) => (
                          <div key={letter || 'all'}>
                            {letter && (
                              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-tertiary dark:text-[#6b6b70] border-b border-border-subtle dark:border-white/5 pb-2">{letter}</h3>
                            )}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              {platforms.map((platform, index) => (
                                <button
                                  key={platform.name}
                                  type="button"
                                  onClick={() => onRequestNavigation(() => onSelectPlatformName(platform.name))}
                                  className="animate-vault-slide-up flex items-center gap-4 rounded-2xl border border-black/[0.06] bg-white/80 dark:border-white/10 dark:bg-[#1c1c1e]/80 p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-0.5 hover:scale-[1.02] hover:border-black/10 hover:bg-white dark:hover:bg-[#2c2c2e]"
                                  style={{ animationDelay: `${index * 40}ms` }}
                                >
                                  <PlatformLogo name={getCanonicalPlatformName(platform.name)} className="h-11 w-11 rounded-2xl border border-black/[0.05] bg-white p-1 shadow-sm dark:border-white/5 dark:bg-[#2c2c2e]" />
                                  <span className="min-w-0 flex-1 relative">
                                    <span className="block break-words line-clamp-2 text-sm font-semibold text-text-primary pr-5 dark:text-white leading-tight" title={getCanonicalPlatformName(platform.name)}>{getCanonicalPlatformName(platform.name)}</span>
                                    {(!hideWarnings && platform.hasWeakPassword) && (
                                      <div className="absolute right-0 top-0 text-amber-500" title="Al menos una cuenta tiene contraseña débil">
                                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    )}
                                    <span className="mt-1 block text-xs text-text-secondary dark:text-slate-400">
                                      {platform.count} cuenta{platform.count !== 1 ? 's' : ''} registradas
                                    </span>
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-text-secondary dark:bg-slate-900 dark:text-slate-300">
                                    Abrir
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : syncing ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 animate-pulse">
                        {Array.from({ length: 16 }, (_, i) => i).map(i => (
                          <div key={i} className="flex min-h-[76px] items-center gap-4 rounded-2xl border border-black/5 bg-white/50 dark:bg-slate-800/50 dark:border-white/5 p-4">
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
                          <div key={i} className="flex min-h-[76px] items-center gap-4 rounded-2xl border border-black/5 bg-white/50 dark:bg-slate-800/50 dark:border-white/5 p-4">
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
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 dark:bg-slate-700 dark:ring-white/10 text-text-secondary dark:text-slate-300">
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
                          className="animate-vault-slide-up flex items-center gap-4 rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white/80 dark:bg-[#1c1c1e]/80 p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-0.5 hover:scale-[1.02] hover:border-black/10 dark:hover:border-white/20 hover:bg-white dark:hover:bg-[#2c2c2e]"
                          style={{ animationDelay: `${index * 40}ms` }}
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700/50 font-bold text-text-primary dark:text-white ring-1 ring-black/5 dark:ring-white/5">
                            {idItem.email.charAt(0).toUpperCase()}
                          </div>
                          <span className="min-w-0 flex-1 relative">
                            <span className="block break-words line-clamp-2 leading-tight text-sm font-semibold text-text-primary dark:text-white pr-5" title={idItem.email}>{idItem.email}</span>
                            <span className="mt-1 block text-xs text-text-secondary">
                              {(idItem?.platforms || []).length} plataforma{(idItem?.platforms || []).length !== 1 ? 's' : ''} vinculada{(idItem?.platforms || []).length !== 1 ? 's' : ''}
                            </span>
                          </span>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-700/50 px-2.5 py-1 text-[10px] font-bold text-text-secondary dark:text-slate-300">
                            Abrir
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : syncing ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 animate-pulse">
                      {Array.from({ length: 16 }, (_, i) => i).map(i => (
                        <div key={i} className="flex min-h-[76px] items-center gap-4 rounded-2xl border border-black/5 bg-white/50 dark:bg-slate-800/50 p-4">
                          <div className="h-11 w-11 rounded-2xl bg-black/10 dark:bg-white/10"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-3.5 w-1/2 rounded bg-black/10 dark:bg-white/10"></div>
                            <div className="h-2.5 w-1/3 rounded bg-black/5 dark:bg-white/5"></div>
                          </div>
                          <div className="h-5 w-10 rounded-full bg-black/5 dark:bg-white/5"></div>
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



  return (
    <div className="flex min-h-0 flex-1 flex-col dark:bg-slate-900">
      {!isFormView && (
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border-subtle bg-white/72 dark:bg-slate-900/72 px-4 py-3 shadow-sm backdrop-blur-xl lg:px-8 lg:py-5">
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
          <h2 className="truncate text-lg font-semibold text-text-primary dark:text-white">
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

        {(identity || groupMode === 'platform') && !localCategory && (
          <button
            type="button"
            title="Compartir"
            onClick={() => {
              if (groupMode === 'platform') {
                setShowShareModal({
                  type: 'bundle',
                  identity: { id: 'bundle', email: selectedPlatformName || 'Cuentas', platforms: platformAccounts.map(pa => pa.platform), createdAt: '', updatedAt: '' },
                  platforms: platformAccounts.map(pa => pa.platform)
                })
              } else if (identity) {
                setShowShareModal({
                  type: 'bundle',
                  identity: identity,
                  platforms: identity.platforms || []
                })
              }
            }}
            className="rounded-lg border border-border-subtle bg-surface-elevated dark:bg-slate-800 px-3 py-2 text-sm font-medium text-text-primary dark:text-white shadow-subtle transition-colors hover:bg-surface-hover dark:hover:bg-slate-700 flex items-center gap-1.5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="hidden sm:block">Compartir</span>
          </button>
        )}
        {(localCategory || identity || groupMode === 'platform') && (
          <button
            type="button"
            onClick={() => {
              if (localCategory) {
                setEditingLocalItem(createLocalVaultItem(localCategory.type, localCategory.id, localCategory.label))
              } else {
                const targetIdentity = identity || identities[0]
                if (targetIdentity) {
                  setEditingPlatform({
                    identityId: targetIdentity.id,
                    identityEmail: targetIdentity.email,
                    platform: createPlatform(groupMode === 'platform' && selectedPlatformName ? selectedPlatformName : '', { username: '' }),
                  })
                }
              }
              setView('create')
            }}
            className="rounded-lg border border-border-subtle bg-surface-elevated dark:bg-slate-800 px-3 py-2 text-sm font-medium text-text-primary dark:text-white shadow-subtle transition-colors hover:bg-surface-hover dark:hover:bg-slate-700"
          >
            Añadir
          </button>
        )}
      </header>
      )}

      <div ref={scrollContainerRef} className={`flex-1 min-h-0 overflow-y-auto overscroll-contain relative ${isFormView ? '' : 'px-4 py-4 pb-24 lg:px-8 lg:py-6'}`}>
        {!isFormView && availableLetters.length > 0 && (
          <AlphabetScroller letters={availableLetters} onLetterSelect={handleLetterSelect} />
        )}
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
                <div className="space-y-8">
                  {Array.from(
                    filteredLocalItems.reduce((acc, item) => {
                      const sec = item.section?.trim() || 'General'
                      if (!acc.has(sec)) acc.set(sec, [])
                      acc.get(sec)!.push(item)
                      return acc
                    }, new Map<string, LocalVaultItem[]>())
                  )
                  .sort(([a], [b]) => a === 'General' ? -1 : b === 'General' ? 1 : a.localeCompare(b))
                  .map(([sectionName, items]) => (
                    <div key={sectionName}>
                      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-tertiary dark:text-[#6b6b70]">
                        {sectionName.split('/').map((part, i, arr) => (
                          <span key={i} className="flex items-center gap-1.5">
                            <span className={i === arr.length - 1 ? 'text-text-secondary dark:text-gray-400' : ''}>{part.trim()}</span>
                            {i < arr.length - 1 && <span>›</span>}
                          </span>
                        ))}
                      </h3>
                      <div className="grid grid-cols-1 gap-4 pr-1 sm:grid-cols-2 xl:grid-cols-3">
                        {items.map((item, index) => {
                          const isDoc = item.type === 'DOCUMENT'
                          const isExpired = isDoc && item.hasExpiry && item.expiryDate && new Date(item.expiryDate) < new Date()
                          return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setEditingLocalItem(item)
                              setView('edit')
                            }}
                            style={{ animationDelay: `${index * 45}ms` }}
                            className={`animate-vault-slide-up relative min-h-[106px] overflow-hidden rounded-2xl border ${isExpired ? 'border-red-300 dark:border-red-500/50 bg-red-50/80 dark:bg-red-900/20' : 'border-black/[0.06] dark:border-white/10 bg-gradient-to-b from-white via-white to-slate-50/90 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900/90'} p-4 text-left shadow-[0_18px_55px_rgba(15,23,42,0.05)] backdrop-blur transition-all duration-150 hover:-translate-y-1 hover:scale-[1.02] hover:border-black/10 dark:hover:border-white/20 hover:shadow-[0_24px_70px_rgba(15,23,42,0.08)] active:scale-[0.98]`}
                          >
                            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />
                            <div className="flex items-center justify-between">
                              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
                                {LOCAL_ITEM_LABELS[item.type]}
                              </span>
                              {isExpired && (
                                <span className="text-red-500" title="Este documento ha caducado">
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-1.998A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" /></svg>
                                </span>
                              )}
                            </div>
                            <span className="mt-2 block truncate text-sm font-semibold text-text-primary dark:text-white">
                              {vaultItemDisplayName(item)}
                            </span>
                            <span className="mt-3 inline-flex gap-1.5 flex-wrap">
                              <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                                Cifrado local
                              </span>
                              {isDoc && item.pastVersions && item.pastVersions.length > 0 && (
                                <span className="rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 text-[10px] font-semibold">
                                  {item.pastVersions.length} {item.pastVersions.length === 1 ? 'versión ant.' : 'versiones ant.'}
                                </span>
                              )}
                            </span>
                          </button>
                        )})}
                      </div>
                    </div>
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
                        className="animate-vault-slide-up relative flex w-full min-h-[112px] items-start gap-3 rounded-2xl border border-black/[0.06] dark:border-white/10 bg-gradient-to-b from-white via-white to-slate-50/90 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900/90 p-4 text-left shadow-[0_18px_55px_rgba(15,23,42,0.05)] backdrop-blur transition-all duration-150 hover:-translate-y-1 hover:scale-[1.02] hover:border-black/10 dark:hover:border-white/20 hover:shadow-[0_24px_70px_rgba(15,23,42,0.08)] active:scale-[0.98]"
                      >
                        <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
                        <PlatformLogo name={getCanonicalPlatformName(platform.name)} className="h-9 w-9" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-text-primary dark:text-white min-h-[20px] pr-5">
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
                      {(!hideWarnings && hasWeakPassword(platform) && !hasExposedPassword(platform)) && (
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
                      {(!hideWarnings && hasExposedPassword(platform)) && (
                        <ExposedPasswordWarningPopover
                          className="absolute right-3 top-3 z-20"
                          onIgnore={() => void onUpdatePlatform(identityId, platform.id, { ...platform, ignoreExposedPasswordWarning: true })}
                          onDisableGlobally={() => {
                            window.localStorage.setItem('contras.hideWeakPasswordWarnings', 'true')
                            window.dispatchEvent(new Event('contras:weak-passwords-toggled'))
                            window.dispatchEvent(new Event('contras:open-settings'))
                          }}
                        />
                      )}
                      {/* Actions Footer */}
                      {(pwMethod?.password || hasUrl) && (
                        <div className="absolute bottom-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity items-center">
                          {pwMethod?.password && (
                            <>
                              <button
                              type="button"
                              title={revealedPasswords.has(`${identityId}-${platform.id}`) ? "Ocultar" : "Mostrar contraseña"}
                              onClick={(e) => {
                                e.stopPropagation()
                                const key = `${identityId}-${platform.id}`
                                if (revealedPasswords.has(key)) {
                                  setRevealedPasswords(prev => {
                                    const next = new Set(prev)
                                    next.delete(key)
                                    return next
                                  })
                                } else {
                                  handleRequireAuth(() => {
                                    setRevealedPasswords(prev => {
                                      const next = new Set(prev)
                                      next.add(key)
                                      return next
                                    })
                                  }, key)
                                }
                              }}
                              className={`p-1.5 rounded-lg text-xs font-bold shadow-sm border transition-all ${
                                revealedPasswords.has(`${identityId}-${platform.id}`)
                                  ? 'bg-slate-100 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50'
                                  : 'bg-white/95 dark:bg-slate-800 text-text-secondary dark:text-slate-400 border-black/10 dark:border-white/10 hover:text-indigo-600 dark:hover:text-indigo-400'
                              }`}
                            >
                              {revealedPasswords.has(`${identityId}-${platform.id}`) ? (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              )}
                            </button>
                              <button
                                type="button"
                                title="Copiar contraseña"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  handleRequireAuth(async () => {
                                    try {
                                      await navigator.clipboard.writeText(pwMethod.password)
                                      setQuickTravelCopied(`${identityId}-${platform.id}-pw`)
                                      setTimeout(() => setQuickTravelCopied(null), 2000)
                                    } catch {}
                                  }, `${identityId}-${platform.id}`)
                                }}
                                className={`p-1.5 rounded-lg text-xs font-bold shadow-sm border transition-all ${
                                  quickTravelCopied === `${identityId}-${platform.id}-pw`
                                    ? 'bg-green-500 text-white border-green-400'
                                    : 'bg-white/95 dark:bg-slate-800 text-text-secondary dark:text-slate-400 border-black/10 dark:border-white/10 hover:text-indigo-600 dark:hover:text-indigo-400'
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
                                  handleRequireAuth(async () => {
                                    try {
                                      await navigator.clipboard.writeText(pwMethod.password)
                                      setQuickTravelCopied(`${identityId}-${platform.id}-travel`)
                                      setTimeout(() => setQuickTravelCopied(null), 2000)
                                      window.open(getPlatformUrl((platform as any).url || platform.name), '_blank')
                                    } catch {}
                                  }, `${identityId}-${platform.id}`)
                                }}
                                className={`p-1.5 rounded-lg text-xs font-bold shadow-sm border transition-all ${
                                  quickTravelCopied === `${identityId}-${platform.id}-travel`
                                    ? 'bg-green-500 text-white border-green-400'
                                    : 'bg-white/95 dark:bg-slate-800 text-text-secondary dark:text-slate-400 border-black/10 dark:border-white/10 hover:text-indigo-600 dark:hover:text-indigo-400'
                                }`}
                              >
                                {quickTravelCopied === `${identityId}-${platform.id}-travel` ? (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                )}
                              </button>
                              <button
                                type="button"
                                title="Probar acceso"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  handleRequireAuth(async () => {
                                    try {
                                      await navigator.clipboard.writeText(pwMethod.password)
                                      window.open(getPlatformUrl((platform as any).url || platform.name), '_blank')
                                      setTestPasswordModalOpen({ identityId, platform })
                                    } catch {}
                                  }, `${identityId}-${platform.id}`)
                                }}
                                className="ml-1 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-sm border transition-all bg-white/95 dark:bg-slate-800 text-text-secondary dark:text-slate-400 border-black/10 dark:border-white/10 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-700 dark:hover:text-indigo-400 flex items-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Probar
                              </button>
                            </>
                          )}
                          {!pwMethod?.password && hasUrl && (
                            <button
                              type="button"
                              title="Abrir enlace"
                              onClick={(e) => {
                                e.stopPropagation()
                                window.open(getPlatformUrl((platform as any).url || platform.name), '_blank')
                              }}
                              className="p-1.5 rounded-lg text-xs font-bold shadow-sm border transition-all bg-white/95 dark:bg-slate-800 text-text-secondary dark:text-slate-400 border-black/10 dark:border-white/10 hover:text-indigo-600 dark:hover:text-indigo-400"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </button>
                          )}
                        </div>
                      )}
                      {/* Revealed Password Banner */}
                      {pwMethod?.password && revealedPasswords.has(`${identityId}-${platform.id}`) && (
                        <div className="absolute left-4 right-20 bottom-3">
                          <div className="inline-flex items-center gap-3 rounded-lg border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#1c1c1e] px-3 py-1.5 shadow-sm">
                            <span className="font-mono text-xs font-semibold tracking-wider text-text-primary dark:text-slate-200 select-all" onClick={(e) => e.stopPropagation()}>
                              {pwMethod.password}
                            </span>
                          </div>
                        </div>
                      )}
                      {/* Last Verified Banner */}
                      {platform.lastVerifiedAt && !revealedPasswords.has(`${identityId}-${platform.id}`) && (
                        <div className="absolute left-4 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="inline-flex items-center gap-1 rounded-md bg-green-50 dark:bg-green-900/20 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400 border border-green-200/50 dark:border-green-800/50">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            Verificada
                          </span>
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
                  const letter = platform.name.charAt(0).toUpperCase()
                  const isFirstOfLetter = index === 0 || identityPlatforms[index - 1].name.charAt(0).toUpperCase() !== letter
                  const showLetterHeader = (sortMode === 'alpha-asc' || sortMode === 'alpha-desc') && groupMode === 'identity' && !itemQuery && isFirstOfLetter && /[A-Z]/.test(letter)
                  const pwMethod = (platform.accessMethods || []).find((m: any) => m?.type === 'PASSWORD') as any
                  return (
                  <div key={platform.id} className="contents">
                    {showLetterHeader && (
                      <div id={`letter-${letter}`} className="col-span-full pt-6 pb-2 text-xl font-black text-slate-300 drop-shadow-sm flex items-center gap-4">
                        {letter}
                        <div className="h-px bg-slate-200 flex-1"></div>
                      </div>
                    )}
                  <div className="relative group">
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
                      className="animate-vault-slide-up relative flex w-full min-h-[112px] items-start gap-3 overflow-hidden rounded-2xl border border-black/[0.06] dark:border-white/10 bg-gradient-to-b from-white via-white to-slate-50/90 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900/90 p-4 text-left shadow-[0_18px_55px_rgba(15,23,42,0.05)] backdrop-blur transition-all duration-150 hover:-translate-y-1 hover:scale-[1.02] hover:border-black/10 dark:hover:border-white/20 hover:shadow-[0_24px_70px_rgba(15,23,42,0.08)] active:scale-[0.98]"
                    >
                    <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />
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
                    {(!hideWarnings && hasWeakPassword(platform) && !hasExposedPassword(platform)) && identity && (
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
                    {(!hideWarnings && hasExposedPassword(platform)) && identity && (
                      <ExposedPasswordWarningPopover
                        className="absolute right-3 top-3 z-20"
                        onIgnore={() => void onUpdatePlatform(identity.id, platform.id, { ...platform, ignoreExposedPasswordWarning: true })}
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
                              : 'bg-white/95 text-text-secondary border-black/10 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-400 dark:border-white/10 dark:hover:text-indigo-400'
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
                              : 'bg-white/95 text-text-secondary border-black/10 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-400 dark:border-white/10 dark:hover:text-indigo-400'
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
            onShare={() => editingPlatform && setShowShareModal({ type: 'single', platform: editingPlatform.platform, identityEmail: editingPlatform.identityEmail })}
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

        {/* Modales de Seguridad y Verificación */}
        {securityModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-black/10 dark:border-white/10 animate-vault-scale-up">
              <h3 className="text-lg font-bold text-text-primary dark:text-white mb-2">Autenticación requerida</h3>
              <p className="text-sm text-text-secondary dark:text-slate-400 mb-6">Confirma tu Contraseña Maestra para ver o copiar esta credencial.</p>
              <form onSubmit={async (e) => {
                e.preventDefault()
                if (!securityPassword || !onVerifyMasterPassword) return
                try {
                  const isValid = await onVerifyMasterPassword(securityPassword)
                  if (isValid) {
                    setSecurityModalOpen(false)
                    setSecurityPassword('')
                    setSecurityError(null)
                    if (pendingSecurityAction) {
                      setAuthVerifiedFor(prev => {
                        const n = new Set(prev)
                        n.add(pendingSecurityAction.key)
                        return n
                      })
                      pendingSecurityAction.action()
                    }
                  } else {
                    setSecurityError('Contraseña incorrecta')
                  }
                } catch {
                  setSecurityError('Error al verificar')
                }
              }}>
                <input
                  type="password"
                  autoFocus
                  placeholder="Contraseña Maestra"
                  value={securityPassword}
                  onChange={e => { setSecurityPassword(e.target.value); setSecurityError(null) }}
                  className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-slate-800 dark:text-white mb-4"
                />
                {securityError && <p className="mb-4 text-xs font-bold text-red-500">{securityError}</p>}
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => { setSecurityModalOpen(false); setSecurityPassword(''); setSecurityError(null); setPendingSecurityAction(null); }} className="rounded-xl px-4 py-2.5 text-sm font-bold text-text-secondary hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Cancelar</button>
                  <button type="submit" disabled={!securityPassword} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">Confirmar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {testPasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-black/10 dark:border-white/10 animate-vault-scale-up text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-text-primary dark:text-white mb-2">Prueba Semi-Asistida</h3>
              <p className="text-sm text-text-secondary dark:text-slate-400 mb-6">Debido a las protecciones antibot (Captchas/CORS), el inicio de sesión no puede ser 100% invisible. Hemos <strong>copiado tu contraseña</strong> y abierto la web en una nueva pestaña. ¿Pudiste entrar?</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const platform = testPasswordModalOpen.platform
                    await onUpdatePlatform(testPasswordModalOpen.identityId, platform.id, {
                      ...platform,
                      lastVerifiedAt: new Date().toISOString()
                    })
                    setTestPasswordModalOpen(null)
                  }}
                  className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-green-700"
                >
                  Sí, marcar como Verificada
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const { identityId, platform } = testPasswordModalOpen
                    setTestPasswordModalOpen(null)
                    setEditingPlatform({
                      identityId,
                      identityEmail: identities.find(i => i.id === identityId)?.email || '',
                      platform
                    })
                    setView('edit')
                  }}
                  className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-sm font-bold text-text-secondary dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  No, quiero actualizarla
                </button>
                <button
                  type="button"
                  onClick={() => setTestPasswordModalOpen(null)}
                  className="w-full rounded-xl px-4 py-3 text-sm font-bold text-text-tertiary dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})


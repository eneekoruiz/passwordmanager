import { useEffect, useState, useMemo, memo, useRef, useCallback } from 'react'
import type { Identity, LocalCategory, LocalVaultItem, LocalVaultItemType, VaultGroupMode, SortMode } from '../types'
import { useToast } from './ui/ToastProvider'
import { useVault } from '../context/VaultContext'
import { getFriendlyErrorMessage } from '../utils/errors'
import { LOCAL_IDENTITY_EMAIL } from '../utils/identity'
import { LOCAL_ITEM_LABELS, PRESET_LOCAL_CATEGORIES, normalizeLocalCategory } from '../utils/vaultItem'
import { PlatformLogo } from './ui/PlatformLogo'
import { getCanonicalPlatformName } from '../utils/platformUtils'
import { generateId } from '../utils/id'
import { hasWeakPassword, hasExposedPassword } from '../utils/security'
import { AlphaScrollBar } from './ui/AlphaScrollBar'
import { InputModal } from './ui/InputModal'

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
  const { cloudUserEmail, cloudSyncStatus, cloudVaultExists, localCategories, saveLocalCategory, deleteLocalCategory } = useVault()
  const { showToast } = useToast()
  const [newIdentityEmail, setNewIdentityEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [showCheck, setShowCheck] = useState(false)
  const [pendingDeleteIdentityId, setPendingDeleteIdentityId] = useState<string | null>(null)
  const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState<string | null>(null)
  const [sidebarError, setSidebarError] = useState<string | null>(null)
  const [activeMenuCategoryId, setActiveMenuCategoryId] = useState<string | null>(null)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [promptModalConfig, setPromptModalConfig] = useState<{ isOpen: boolean, parentId?: string }>({ isOpen: false })
  const [activeLetter, setActiveLetter] = useState<string>('')
  const navRef = useRef<HTMLElement>(null)
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
    const platformData = new Map<string, { name: string; count: number; minDate: string; maxDate: string; maxAccessDate: string; hasWeakPassword: boolean; hasExposedPassword: boolean }>()
    for (const identity of cloudIdentities) {
      for (const platform of (identity?.platforms || [])) {
        const name = platform.name.trim()
        if (!name) continue
        const key = name.toLowerCase()
        const date = platform.createdAt || new Date(0).toISOString()
        const accessDate = platform.lastAccessedAt || platform.updatedAt || platform.createdAt || ''
        const existing = platformData.get(key)
        if (existing) {
          existing.count += 1
          if (date < existing.minDate) existing.minDate = date
          if (date > existing.maxDate) existing.maxDate = date
          if (accessDate > existing.maxAccessDate) existing.maxAccessDate = accessDate
          existing.hasWeakPassword = existing.hasWeakPassword || hasWeakPassword(platform)
          existing.hasExposedPassword = existing.hasExposedPassword || hasExposedPassword(platform)
        } else {
          platformData.set(key, {
            name,
            count: 1,
            minDate: date,
            maxDate: date,
            maxAccessDate: accessDate,
            hasWeakPassword: hasWeakPassword(platform),
            hasExposedPassword: hasExposedPassword(platform),
          })
        }
      }
    }

    let list = Array.from(platformData.values())
    if (query) {
      list = list.filter((p) => p.name.toLowerCase().includes(query))
    }

    const effectiveSortMode = !isMobile ? 'access-desc' : sortMode
    list.sort((a, b) => {
      switch (effectiveSortMode) {
        case 'alpha-asc':
          return a.name.localeCompare(b.name)
        case 'alpha-desc':
          return b.name.localeCompare(a.name)
        case 'created-desc':
          return b.maxDate.localeCompare(a.maxDate)
        case 'created-asc':
          return a.minDate.localeCompare(b.minDate)
        case 'access-desc':
          return (b.maxAccessDate || b.maxDate).localeCompare(a.maxAccessDate || a.maxDate)
        case 'usage-desc':
          return b.count - a.count || a.name.localeCompare(b.name)
        default:
          return 0
      }
    })
    return list
  }, [cloudIdentities, query, sortMode])

  // A-Z grouping for platform mode
  const platformsByLetter = useMemo(() => {
    const effectiveSortMode = !isMobile ? 'access-desc' : sortMode
    if (effectiveSortMode !== 'alpha-asc' && effectiveSortMode !== 'alpha-desc') return null
    const groups = new Map<string, typeof platformSummaries>()
    for (const p of platformSummaries) {
      const first = p.name[0]?.toUpperCase() ?? '#'
      const letter = /^[A-Z]/.test(first) ? first : '#'
      const arr = groups.get(letter) ?? []
      arr.push(p)
      groups.set(letter, arr)
    }
    return groups
  }, [platformSummaries, sortMode])

  const availableLetters = useMemo(() => {
    const s = new Set<string>()
    if (platformsByLetter) {
      for (const k of platformsByLetter.keys()) s.add(k)
    }
    return s
  }, [platformsByLetter])

  const handleLetterSelect = useCallback((letter: string) => {
    setActiveLetter(letter)
    // Scroll to the letter section
    const nav = navRef.current
    if (!nav) return
    const el = nav.querySelector(`[data-letter-section="${letter}"]`)
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [])

  // Track active letter during scroll
  useEffect(() => {
    const nav = navRef.current
    if (!nav || !platformsByLetter) return
    const onScroll = () => {
      const sections = nav.querySelectorAll<HTMLElement>('[data-letter-section]')
      let current = ''
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= nav.getBoundingClientRect().top + 80) {
          current = section.dataset.letterSection ?? ''
        }
      }
      if (current) setActiveLetter(current)
    }
    nav.addEventListener('scroll', onScroll, { passive: true })
    return () => nav.removeEventListener('scroll', onScroll)
  }, [platformsByLetter])

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
      .sort((a, b) => (b.maxAccessDate || b.maxDate).localeCompare(a.maxAccessDate || a.maxDate))
      .slice(0, 4)
  }, [isMobile, platformSummaries])

  const sidebarLocalCategories = useMemo(() => {
    if (isMobile) return visibleLocalCategories
    return [...visibleLocalCategories]
      .sort((a, b) => recentTime(b.updatedAt, b.createdAt) - recentTime(a.updatedAt, a.createdAt))
  }, [isMobile, visibleLocalCategories])

  const handleAddLocalCategory = (parentId?: string) => {
    setPromptModalConfig({ isOpen: true, parentId })
  }

  const confirmAddLocalCategory = async (label: string) => {
    const cleanLabel = label.trim()
    if (!cleanLabel) return
    
    const parentId = promptModalConfig.parentId
    setPromptModalConfig({ isOpen: false })

    try {
      const category = normalizeLocalCategory({
        id: `custom-${generateId()}`,
        label: cleanLabel,
        type: 'SECURE_NOTE',
        custom: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        parentId: parentId || null
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

  const renderPlatformItem = (platform: { name: string; count: number; hasWeakPassword?: boolean; hasExposedPassword?: boolean }) => {
    const selected = selectedPlatformName?.toLowerCase() === platform.name.toLowerCase()
    const canonicalName = getCanonicalPlatformName(platform.name)
    return (
      <li key={platform.name}>
        <button
          type="button"
          onClick={() => onSelectPlatform(platform.name)}
          className={`vault-card group flex min-h-[86px] w-full items-center gap-3 rounded-[22px] p-3.5 text-left active:scale-[0.98] ${
            selected
              ? 'ring-2 ring-teal-500/25 text-text-primary dark:text-white'
              : 'text-text-secondary dark:text-[#a0a0a5]'
          }`}
        >
          <PlatformLogo name={canonicalName} className="h-11 w-11 rounded-[22px] border border-black/[0.05] bg-white p-1 shadow-sm dark:border-white/5 dark:bg-[#2c2c2e]" />
          <span className="min-w-0 flex-1 pr-5">
            <span className="flex items-center gap-1.5">
              <span className="block min-w-0 truncate text-sm font-bold text-text-primary dark:text-white">{canonicalName}</span>
              {platform.hasWeakPassword && !platform.hasExposedPassword && (
                <span className="shrink-0 text-amber-500" title="Al menos una cuenta tiene contraseña débil">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
              {platform.hasExposedPassword && (
                <span className="shrink-0 text-red-500" title="Al menos una cuenta tiene la contraseña expuesta en filtraciones">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-1.998A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </span>
            <span className="mt-1 block text-xs font-medium text-text-secondary dark:text-[#6b6b70]">
              {platform.count} cuenta{platform.count !== 1 ? 's' : ''} vinculada{platform.count !== 1 ? 's' : ''}
            </span>
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-text-secondary transition-colors group-hover:bg-slate-200 dark:bg-[#2c2c2e] dark:text-[#a0a0a5] dark:group-hover:bg-[#3a3a3c]">Abrir</span>
        </button>
      </li>
    )
  }

  const renderLocalCategoryItem = (category: LocalCategory, index: number, depth: number = 0) => {
    const selected = selectedLocalCategory?.id === category.id
    const count = localCategoryCounts.get(category.id) ?? 0
    const children = sidebarLocalCategories.filter(c => c.parentId === category.id)
    const isSubcategory = depth > 0;
    
    return (
      <li key={category.id} className={`relative ${activeMenuCategoryId === category.id ? 'z-50' : 'z-auto'}`}>
        {isSubcategory && (
          <div 
            className="absolute left-0 top-1/2 w-4 border-b-2 border-black/10 dark:border-white/10"
            style={{ marginLeft: `${(depth - 1) * 1.5 + 1.25}rem` }}
          />
        )}
        
        {children.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsedCategories((prev) => {
                const next = new Set(prev);
                if (next.has(category.id)) next.delete(category.id);
                else next.add(category.id);
                return next;
              });
            }}
            className="absolute left-0 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-text-tertiary transition-transform"
            style={{ 
              marginLeft: `${depth * 1.5 - 0.75}rem`,
              transform: collapsedCategories.has(category.id) ? 'translateY(-50%) rotate(-90deg)' : 'translateY(-50%)'
            }}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        )}

        <div className="flex w-full" style={{ paddingLeft: `${depth * 1.5 + (children.length > 0 ? 0.5 : 0)}rem` }}>
          <div
            style={{ animationDelay: `${index * 35}ms` }}
            className={`vault-card group animate-vault-slide-up flex flex-1 items-center gap-1 rounded-[22px] text-left transition-all ${
              isSubcategory ? 'min-h-[56px] p-1.5' : 'min-h-[86px] p-2 pr-3'
            } ${
              selected ? 'ring-2 ring-teal-500/25 bg-surface-active' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectLocalCategory(category)}
              className="flex min-w-0 flex-1 items-center gap-3 active:scale-[0.98] px-1.5 py-1"
            >
              {!isSubcategory && (
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[22px] border border-black/[0.05] shadow-sm dark:border-white/5 ${selected ? 'bg-black/5 text-text-primary dark:bg-white/10 dark:text-white' : 'bg-white text-text-primary dark:bg-[#2c2c2e] dark:text-white'}`}>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-6a2.25 2.25 0 00-2.25-2.25h-4.879a2.25 2.25 0 01-1.59-.659L9.659 4.22A2.25 2.25 0 008.069 3.56H6.75A2.25 2.25 0 004.5 5.81v12.44A2.25 2.25 0 006.75 20.5h10.5a2.25 2.25 0 002.25-2.25v-4z" />
                  </svg>
                </span>
              )}
              {isSubcategory && (
                 <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/[0.05] dark:border-white/5 ${selected ? 'bg-black/5 text-text-primary' : 'bg-white text-text-secondary dark:bg-[#2c2c2e]'}`}>
                   <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                   </svg>
                 </span>
              )}
              <span className="min-w-0 flex-1">
                <span className={`block break-words line-clamp-2 leading-tight font-bold ${selected ? 'text-text-primary dark:text-white' : 'text-text-secondary dark:text-[#a0a0a5]'} ${isSubcategory ? 'text-xs' : 'text-sm'}`} title={category.label}>{category.label}</span>
                <span className={`mt-0.5 block font-medium text-text-tertiary dark:text-[#6b6b70] ${isSubcategory ? 'text-[10px]' : 'text-xs'}`}>
                  {count} elemento{count !== 1 ? 's' : ''} local{count !== 1 ? 'es' : ''}
                </span>
              </span>
            </button>
            
            <div className="relative flex shrink-0">
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuCategoryId(activeMenuCategoryId === category.id ? null : category.id);
                }} 
                className={`flex items-center justify-center rounded-2xl border border-transparent text-text-tertiary transition-all hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5 dark:hover:text-white ${isSubcategory ? 'h-7 w-7' : 'h-9 w-9'}`}
                title="Opciones"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                </svg>
              </button>

              {activeMenuCategoryId === category.id && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-black/5 backdrop-blur-[1px] dark:bg-white/5"
                    onClick={(e) => { e.stopPropagation(); setActiveMenuCategoryId(null); }}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-2xl border border-border-subtle bg-white dark:bg-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuCategoryId(null);
                        handleAddLocalCategory(category.id);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-hover transition-colors"
                    >
                      <svg className="h-4 w-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Añadir subcarpeta
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuCategoryId(null);
                        setPendingDeleteCategoryId(category.id);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {children.length > 0 && !collapsedCategories.has(category.id) && (
          <ul className="mt-2 space-y-1 relative">
            <div className="absolute left-6 top-[-10px] bottom-6 w-[2px] bg-black/10 dark:bg-white/10" style={{ marginLeft: `${depth * 1.5}rem` }} />
            {children.map((child, childIdx) => renderLocalCategoryItem(child, childIdx, depth + 1))}
          </ul>
        )}
      </li>
    )
  }

  const renderEmptyNavigationState = (label: string, onCreate: () => void) => (
    <div className="vault-panel mx-3 mt-4 rounded-[24px] border-dashed px-4 py-8 text-center animate-vault-morph">
      <p className="text-sm font-bold text-text-primary">Aún no tienes elementos aquí</p>
      <button
        type="button"
        onClick={onCreate}
        className="vault-button-primary mt-3 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold text-white transition-all hover:-translate-y-0.5 active:scale-[0.98]"
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
          className={`vault-card group relative rounded-[22px] p-3.5 ${
            selected ? 'ring-2 ring-teal-500/25' : ''
          }`}
        >
          <button type="button" onClick={() => onSelect(identity.id)} className="flex min-h-[74px] w-full items-center gap-3 text-left active:scale-[0.99]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[22px] bg-slate-100 font-bold text-text-primary ring-1 ring-black/5">
              {identity.email.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block break-all text-sm font-bold text-text-primary">{identity.email}</span>
              <span className="mt-1 block text-xs font-medium text-text-secondary">
                {platformCount} plataforma{platformCount !== 1 ? 's' : ''} vinculada{platformCount !== 1 ? 's' : ''}
              </span>
              {platformCount > 0 && (
                <span className="mt-2 flex items-center gap-2">
                  <span className="flex -space-x-2">
                    {(identity?.platforms || []).slice(0, 3).map((platform) => (
                      <PlatformLogo key={`${identity.id}-${platform.id}`} name={platform.name} className="h-6 w-6 rounded-lg border border-white dark:border-[#2c2c2e] bg-white dark:bg-[#2c2c2e] p-0.5 shadow-sm" />
                    ))}
                  </span>
                  <span className="truncate text-[11px] font-medium text-text-tertiary">
                    {(identity?.platforms || []).slice(0, 2).map((platform) => platform.name).join(' · ')}
                    {platformCount > 2 ? ` +${platformCount - 2}` : ''}
                  </span>
                </span>
              )}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-text-secondary transition-colors group-hover:bg-slate-200 dark:bg-[#2c2c2e] dark:text-[#a0a0a5] dark:group-hover:bg-[#3a3a3c]">Abrir</span>
          </button>
          <button
            type="button"
            onClick={() => setPendingDeleteIdentityId(pendingDeleteIdentityId === identity.id ? null : identity.id)}
            className="absolute right-2 top-2 rounded-2xl p-2 text-text-tertiary opacity-100 transition-colors hover:bg-red-50 hover:text-red-600 lg:opacity-0 lg:group-hover:opacity-100"
            aria-label="Eliminar identidad"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {pendingDeleteIdentityId === identity.id && (
          <div className="mx-3 mt-2 rounded-2xl border border-red-100 bg-red-50/80 px-3 py-2 text-xs text-red-700">
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
            ? 'flex h-full w-full flex-col bg-transparent'
            : `
              fixed inset-y-0 left-0 z-30 flex h-screen w-full max-w-[320px] flex-col
              border-r border-border-subtle bg-surface transition-transform duration-300 ease-out
              dark:border-[#2c2c2e] dark:bg-[#0f0f10]
              lg:sticky lg:top-0 lg:z-auto lg:w-80 lg:max-w-none lg:translate-x-0
              \${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `
        }
        aria-label="Lista de identidades"
      >
        {!isMobile && (
          <header className="px-4 pb-4 pt-5 lg:px-5 lg:pt-6">
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-text-primary dark:text-white">Contras</h1>
                {activeSyncIndicator}
              </div>
              {profileName && (
                <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  {profileName}
                </p>
              )}
            </div>
          </header>
        )}

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
                className="rounded-lg vault-button-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {adding ? '...' : 'OK'}
              </button>
            </div>
          </div>
        )}

        <div className="px-4 pb-3 lg:px-5">
          {sidebarError && (
            <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {sidebarError}
            </div>
          )}
          <div className="vault-control mb-3 hidden grid-cols-3 rounded-[22px] p-1 md:grid">
            {(['identity', 'platform', 'local'] as VaultGroupMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onGroupModeChange(mode)}
                className={`min-h-10 rounded-[18px] px-2 py-1.5 text-xs font-bold transition-all duration-150 ${
                  groupMode === mode
                    ? 'vault-button-primary text-white shadow-[0_8px_22px_rgba(15,23,42,0.14)]'
                    : 'text-text-secondary hover:bg-surface-hover dark:text-[#a0a0a5] dark:hover:bg-slate-800/50'
                }`}
              >
                {mode === 'identity' ? 'Identidades' : mode === 'platform' ? 'Plataformas' : 'Locales'}
              </button>
            ))}
          </div>
        </div>

        <nav ref={navRef} className="relative flex-1 overflow-y-auto scrollbar-thin px-2 pb-5 lg:px-3">
          {(syncing || (cloudVaultExists === true && cloudSyncStatus === 'idle')) && localLooksEmpty ? (
            <div className="space-y-4 px-3 py-4">
              <div className="h-3 w-1/3 rounded-full bg-slate-200/60 shimmer mb-6" />
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <div className="h-10 w-10 shrink-0 rounded-2xl bg-slate-200/50 shimmer" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-3/4 rounded-full bg-slate-200/70 shimmer" />
                      <div className="h-2.5 w-1/2 rounded-full bg-slate-100/60 shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {groupMode !== 'local' && (
                <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary dark:text-[#6b6b70]">
                  {groupMode === 'identity' ? 'Identidades Cloud' : 'Plataformas Cloud'}
                </div>
              )}
              {groupMode === 'platform' ? (
                sidebarPlatforms.length === 0 ? (
                  renderEmptyNavigationState('Crea una plataforma aquí', onAddClick)
                ) : (
                  <div className="relative pr-6">
                    {/* A-Z side bar — only in alpha sort, no search query, and enough items */}
                    {platformsByLetter && !searchQuery && sidebarPlatforms.length > 10 && (
                      <AlphaScrollBar
                        onLetterSelect={handleLetterSelect}
                        activeLetter={activeLetter}
                        availableLetters={availableLetters}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectPlatform(null)}
                      className={`mb-4 flex min-h-[76px] w-full items-center justify-between rounded-[22px] border border-black/[0.04] px-3.5 py-3 text-left shadow-sm transition-colors dark:border-white/[0.04] ${
                        selectedPlatformName === null
                          ? 'bg-surface-active text-text-primary dark:bg-[#2c2c2e] dark:text-white'
                          : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover dark:bg-[#1c1c1e] dark:text-[#a0a0a5] dark:hover:bg-[#2c2c2e]'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black/5 text-text-primary dark:bg-white/5 dark:text-white">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold leading-tight break-words">Plataformas Cloud</span>
                          <span className="mt-0.5 block text-[11px] font-medium text-text-tertiary dark:text-[#6b6b70] break-words">Todas tus cuentas</span>
                        </span>
                      </span>
                      <span className="flex h-7 min-w-[28px] shrink-0 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold tabular-nums text-text-secondary shadow-sm ring-1 ring-black/[0.04] dark:bg-[#2c2c2e] dark:text-[#a0a0a5]">
                        {platformSummaries.length}
                      </span>
                    </button>
                    {searchQuery ? (
                      <ul className="space-y-3 animate-vault-morph">
                        {sidebarPlatforms
                          .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(renderPlatformItem)}
                      </ul>
                    ) : platformsByLetter ? (
                      /* Alphabetical grouped view */
                      <div className="animate-vault-morph space-y-2">
                        {Array.from(platformsByLetter.entries())
                          .sort(([a], [b]) => sortMode === 'alpha-desc' ? b.localeCompare(a) : a.localeCompare(b))
                          .map(([letter, platforms]) => (
                          <div key={letter}>
                            <div
                              data-letter-section={letter}
                              className="sticky top-0 z-10 flex items-center gap-2 bg-surface/90 py-1.5 px-1 backdrop-blur-sm dark:bg-[#0f0f10]/90"
                            >
                              <span className="text-xs font-black text-text-tertiary dark:text-[#6b6b70]">{letter}</span>
                              <div className="h-px flex-1 bg-border-subtle dark:bg-[#2c2c2e]" />
                              <span className="text-[10px] text-text-tertiary dark:text-[#6b6b70]">{platforms.length}</span>
                            </div>
                            <ul className="space-y-2">
                              {platforms.map(renderPlatformItem)}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="animate-vault-morph">
                        {sidebarPlatforms.length > 0 && (
                          <>
                            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary dark:text-[#6b6b70]">
                              {isMobile ? 'Todas' : 'Más recientes'}
                            </div>
                            <ul className="space-y-3">
                              {sidebarPlatforms.map(renderPlatformItem)}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              ) : groupMode === 'identity' ? (
                sidebarIdentities.length === 0 ? (
                  renderEmptyNavigationState('Crea una identidad aquí', onAddClick)
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelect(null)}
                      className={`mb-4 flex min-h-[76px] w-full items-center justify-between rounded-[22px] border border-black/[0.04] px-3.5 py-3 text-left shadow-sm transition-colors ${
                        selectedId === null ? 'bg-surface-active text-text-primary' : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black/5 text-text-primary">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold leading-tight break-words">Directorio de Identidades</span>
                          <span className="mt-0.5 block text-[11px] font-medium text-text-tertiary break-words">Correos y perfiles cloud</span>
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
                      className="rounded-lg border border-black/5 bg-white px-2 py-1 text-[10px] font-bold text-text-secondary shadow-sm transition-colors hover:bg-surface-hover hover:text-text-primary dark:bg-slate-800 dark:border-white/5 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700"
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
                    <ul className="space-y-0.5">
                      {sidebarLocalCategories.filter(c => !c.parentId).map((c, i) => renderLocalCategoryItem(c, i, 0))}
                    </ul>
                  )}
                </>
              )}
            </>
          )}
        </nav>



        {isMobile && installPromptAvailable && onInstall && (
          <footer className="flex flex-col gap-2.5 border-t border-border-subtle bg-surface p-3 dark:border-[#2c2c2e] dark:bg-[#0f0f10]">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              {cloudUserEmail && (
                <button
                  type="button"
                  onClick={onSync}
                  disabled={cloudSyncStatus === 'syncing'}
                  className="flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border border-black/5 bg-white px-3 text-xs font-bold text-text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-surface-hover disabled:opacity-60 dark:border-white/5 dark:bg-[#1c1c1e] dark:text-white"
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
                className="w-full rounded-2xl vault-button-primary py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-black"
              >
                Instalar Contras App
              </button>
            )}
          </footer>
        )}
      </aside>
      
      {pendingDeleteCategoryId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-premium overflow-hidden animate-in zoom-in-95 duration-200 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/30">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-text-primary dark:text-white mb-2">Eliminar Sección</h3>
            <p className="text-sm text-text-secondary dark:text-[#a0a0a5] mb-6">
              ¿Seguro que deseas eliminar esta categoría? Los elementos dentro de ella se conservarán en tu bóveda pero perderán su carpeta asignada.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setPendingDeleteCategoryId(null)}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-text-secondary hover:bg-slate-100 transition-colors dark:text-[#a0a0a5] dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteLocalCategory(pendingDeleteCategoryId).catch(() => {});
                  setPendingDeleteCategoryId(null);
                }}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-sm transition-transform active:scale-95"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <InputModal
        isOpen={promptModalConfig.isOpen}
        title={promptModalConfig.parentId ? 'Nueva Subcategoría' : 'Nueva Categoría Local'}
        placeholder="Nombre de la categoría"
        onConfirm={confirmAddLocalCategory}
        onCancel={() => setPromptModalConfig({ isOpen: false })}
      />
    </>
  )
})

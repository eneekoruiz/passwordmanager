import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { auth, db } from './services/firebase'
import { VaultProvider, useVault } from './context/VaultContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SyncDiffViewer } from './components/SyncDiffViewer'
import { Sidebar } from './components/Sidebar'
import { MainArea } from './components/MainArea'
import { UnlockScreen } from './components/UnlockScreen'
import { SettingsModal } from './components/SettingsModal'
import { InboxModal } from './components/InboxModal'
import { MasterPasswordPromptModal } from './components/MasterPasswordPromptModal'
import { ImportTextModal } from './components/ImportTextModal'
import { IOSInstallPrompt } from './components/IOSInstallPrompt'
import { LinkPreview } from './components/LinkPreview'
import { getFriendlyErrorMessage, logUnexpectedError } from './utils/errors'
import { LOCAL_ITEM_LABELS, vaultItemDisplayName } from './utils/vaultItem'
import { isInMemoryFallbackActive } from './storage/vaultDb'
import type { LocalCategory, VaultGroupMode, SortMode } from './types'
import type { CloudSyncResult } from './context/VaultContext'
import type { UnsavedFormActions } from './components/AccountForm'
import { useToast } from './components/ui/ToastProvider'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const SORT_LABELS: Record<SortMode, string> = {
  'alpha-asc': 'Alfabético (A-Z)',
  'alpha-desc': 'Alfabético (Z-A)',
  'created-desc': 'Recién creadas',
  'created-asc': 'Más antiguas',
  'access-desc': 'Recién consultadas',
  'usage-desc': 'Más usadas',
}

const SORT_STORAGE_KEY = 'contras.sortMode'

function readStoredSortMode(): SortMode {
  if (typeof window === 'undefined') return 'alpha-asc'
  const stored = window.localStorage.getItem(SORT_STORAGE_KEY)
  return stored === 'alpha-asc' ||
    stored === 'alpha-desc' ||
    stored === 'created-desc' ||
    stored === 'created-asc' ||
    stored === 'access-desc' ||
    stored === 'usage-desc'
    ? stored
    : 'alpha-asc'
}

function VaultApp() {
  const {
    isReady,
    isUnlocked,
    identities,
    localItems,
    addIdentity,
    deleteIdentity,
    addPlatform,
    updatePlatform,
    deletePlatform,
    saveLocalItem,
    deleteLocalItem,
    exportBackup,
    verifyCurrentMasterPassword,
    changeCurrentMasterPassword,
    importBackup,
    importMassiveAccounts,
    currentProfileName,
    currentProfileId,
    cloudSyncStatus,
    isInMemory,
    syncActiveProfileToCloud,
    downloadLatestCloudVault,
    logoutProfile,
    hasUnsyncedChanges,
    biometricAvailable,
    biometricRegistered,
    registerBiometricUnlock,
    disableBiometricUnlock,
    hardwareKeyAvailable,
    hardwareKeyRegistered,
    registerHardwareKeyUnlock,
    disableHardwareKeyUnlock,
    cloudUserEmail,
    localCategories,
    isVaultLoaded,
    mutationCount,
  } = useVault()

  const { showToast } = useToast()

  const [mounted, setMounted] = useState(false)
  const [linkData, setLinkData] = useState<{ id: string; key: string } | null>(null)
  const [inboxCount, setInboxCount] = useState(0)
  const [inboxModalOpen, setInboxModalOpen] = useState(false)

  useEffect(() => {
    if (!auth || !db) return
    let unsubscribe: (() => void) | undefined

    const setupListener = (user: any) => {
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = undefined
      }
      if (user && db) {
        const q = query(collection(db, 'shares'), where('recipientUid', '==', user.uid))
        unsubscribe = onSnapshot(q, (snapshot) => {
          setInboxCount(snapshot.docs.length)
        })
      } else {
        setInboxCount(0)
      }
    }

    const unregisterAuth = auth.onAuthStateChanged(setupListener)
    return () => {
      unregisterAuth()
      if (unsubscribe) unsubscribe()
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    const hash = window.location.hash
    if (hash.startsWith('#/link/')) {
      let id = ''
      let key = ''
      
      // Soporte nuevo formato: #/link/XYZ?key=KEY
      if (hash.includes('?key=')) {
        const [pathPart, queryPart] = hash.split('?')
        id = pathPart.replace('#/link/', '')
        key = queryPart.replace('key=', '')
      } 
      // Soporte formato antiguo: #/link/XYZ#KEY
      else if (hash.includes('#') && hash.split('#').length >= 3) {
        const parts = hash.split('#')
        id = parts[1].replace('/link/', '')
        key = parts[2]
      }
      
      if (id && key) {
        setLinkData({ id, key })
      }
    }
  }, [])

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)

    const handleStorageDegraded = () => {
      showToast(
        'Navegación Privada o Almacenamiento Limitado detectado. La app funciona en modo temporal offline.',
        'warning',
      )
    }

    window.addEventListener('contras:storage-degraded', handleStorageDegraded)

    if (isInMemoryFallbackActive()) {
      handleStorageDegraded()
    }

    return () => {
      window.removeEventListener('resize', checkMobile)
      window.removeEventListener('contras:storage-degraded', handleStorageDegraded)
    }
  }, [showToast])

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent
      if (typeof promptEvent.prompt !== 'function') return

      promptEvent.preventDefault()
      setDeferredPrompt(promptEvent)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallApp = async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
      }
    } catch (error) {
      logUnexpectedError('Error al solicitar la instalacion de la PWA', error)
    }
  }

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [groupMode, setGroupMode] = useState<VaultGroupMode>('platform')
  const [selectedPlatformName, setSelectedPlatformName] = useState<string | null>(null)
  const [selectedLocalCategory, setSelectedLocalCategory] = useState<LocalCategory | null>(null)
  const [globalSearchTerm, setGlobalSearchTerm] = useState('')
  const [localSearchTerm, setLocalSearchTerm] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>(() => readStoredSortMode())
  const [focusCsvExport, setFocusCsvExport] = useState(false)
  const [showMobileSortMenu, setShowMobileSortMenu] = useState(false)
  const [showDesktopSortMenu, setShowDesktopSortMenu] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [createTrigger, setCreateTrigger] = useState(0)

  const handleAddClick = () => {
    if (selectedId || selectedLocalCategory || selectedPlatformName) {
      setCreateTrigger((prev) => prev + 1)
    } else if (groupMode === 'identity') {
      setShowAddForm((prev) => !prev)
    } else if (groupMode === 'platform') {
      let targetId = selectedId
      if (!targetId && displayIdentities.length > 0) {
        targetId = displayIdentities[0].id
        setSelectedId(targetId)
      }
      setCreateTrigger((prev) => prev + 1)
    }
  }

  const handleToggleAddForm = (show?: boolean) => {
    setShowAddForm((prev) => (show !== undefined ? show : !prev))
  }
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInitialView, setSettingsInitialView] = useState<'health' | 'biometric' | 'hardwareKey' | 'credentials' | 'travel' | 'exportPlaintext' | 'exportBackup' | 'importBackup' | 'main'>('health')
  const [editPlatformTrigger, setEditPlatformTrigger] = useState<string | null>(null)
  const clearEditPlatformTrigger = useCallback(() => setEditPlatformTrigger(null), [])
  const [biometricPromptOpen, setBiometricPromptOpen] = useState(false)
  const [importTextOpen, setImportTextOpen] = useState(false)
  const [travelModeEnabled, setTravelModeEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.sessionStorage.getItem('contras.travelMode') === '1'
  })
  const [unsavedDirty, setUnsavedDirty] = useState(false)
  const [unsavedActions, setUnsavedActions] = useState<UnsavedFormActions | null>(null)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false)
  const [lockModalOpen, setLockModalOpen] = useState(false)
  const [savingBeforeNavigation, setSavingBeforeNavigation] = useState(false)
  const [pendingCloudDownload, setPendingCloudDownload] = useState<CloudSyncResult | null>(null)
  const [downloadingCloud, setDownloadingCloud] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [syncPopoverOpen, setSyncPopoverOpen] = useState(false)
  const syncButtonRef = useRef<HTMLButtonElement>(null)
  const [showSyncReminder, setShowSyncReminder] = useState(false)
  const [showSyncCloseWarning, setShowSyncCloseWarning] = useState(false)

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

  const localUpdatedAt = useMemo(() => {
    const timestamps = [
      ...identities.flatMap((identity) => [
        identity.updatedAt,
        identity.createdAt,
        ...identity.platforms.flatMap((platform) => [platform.updatedAt, platform.createdAt]),
      ]),
      ...localItems.flatMap((item) => [item.updatedAt, item.createdAt]),
      ...localCategories.flatMap((category) => [category.updatedAt ?? '', category.createdAt ?? '']),
    ].filter(Boolean)

    const latest = timestamps.reduce((latestVal, value) => {
      const time = Date.parse(value)
      return Number.isFinite(time) ? Math.max(latestVal, time) : latestVal
    }, 0)
    return latest > 0 ? new Date(latest).toLocaleString() : 'Nunca'
  }, [identities, localItems, localCategories])

  const syncState = useMemo(() => {
    const displayStatus = (!isVaultLoaded && (cloudSyncStatus === 'idle' || cloudSyncStatus === 'synced')) ? 'syncing' : cloudSyncStatus;
    if (displayStatus === 'checking_storage') {
      return {
        color: 'text-slate-500 bg-slate-50 border-slate-200 hover:bg-slate-100/50',
        dotColor: 'bg-slate-400',
        label: 'Verificando almacenamiento...',
        description: 'Validando persistencia y sincronización segura...',
        icon: (
          <svg className="h-5 w-5 animate-pulse text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
        )
      }
    }
    if (isInMemory || displayStatus === 'error' || !isOnline) {
      return {
        color: 'text-amber-600 bg-amber-50 border-amber-100 hover:bg-amber-100/50',
        dotColor: 'bg-amber-500',
        label: isInMemory ? 'Modo temporal offline' : 'Bóveda local (Offline o degradado)',
        description: isInMemory
          ? 'Almacenamiento restringido por Navegación Privada o falta de espacio. Tus cambios no se guardarán al salir. Configura la sincronización o añade la app a la pantalla de inicio.'
          : !isOnline
            ? 'Sin conexión a Internet. Operando en modo local.'
            : 'Fallo al sincronizar con Google Cloud. Revisa tu conexión de red.',
        icon: (
          <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )
      }
    }
    if (hasUnsyncedChanges || displayStatus === 'syncing') {
      return {
        color: 'text-blue-500 bg-blue-50 border-blue-100 hover:bg-blue-100/50',
        dotColor: 'bg-blue-500',
        label: displayStatus === 'syncing' ? 'Sincronizando...' : 'Cambios locales pendientes',
        description: displayStatus === 'syncing'
          ? 'Actualizando cambios de forma segura en Google Cloud...'
          : 'Tienes cambios locales guardados. Se subirán a la nube automáticamente en unos segundos.',
        icon: (
          <svg className={`h-5 w-5 ${displayStatus === 'syncing' ? 'animate-pulse' : 'animate-pulse'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
        )
      }
    }
    return {
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-100/50',
      dotColor: 'bg-emerald-500',
      label: 'Bóveda protegida',
      description: cloudUserEmail
        ? 'Todos los datos de tu bóveda están sincronizados de forma segura en Google Cloud.'
        : 'Almacenamiento local persistente y seguro.',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
        </svg>
      )
    }
  }, [isInMemory, cloudSyncStatus, isOnline, hasUnsyncedChanges, cloudUserEmail, isVaultLoaded])

  const CloudSyncIndicator = (
    <div className="relative inline-block">
      <button
        ref={syncButtonRef}
        type="button"
        onClick={() => setSyncPopoverOpen((open) => !open)}
        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${syncState.color}`}
        title="Estado de sincronización"
      >
        {syncState.icon}
      </button>

      {syncPopoverOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setSyncPopoverOpen(false)} />
          <div
            className="fixed z-[70] w-72 max-w-[90vw] rounded-2xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-slate-800 p-4 shadow-xl text-left animate-fade-in"
            style={(() => {
              const rect = syncButtonRef.current?.getBoundingClientRect()
              if (!rect) return { top: 0, left: 0 }
              const top = rect.bottom + 8
              const left = Math.max(8, Math.min(rect.left, window.innerWidth - 296))
              return { top, left }
            })()}
          >
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">
              Estado de Sincronización
            </h4>
            <div className="flex items-center gap-2 mb-3">
              <span className={`h-2.5 w-2.5 rounded-full ${syncState.dotColor}`} />
              <span className="text-sm font-semibold text-text-primary">{syncState.label}</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed mb-4">
              {syncState.description}
            </p>
            <div className="text-[11px] text-text-tertiary space-y-1 border-t border-black/[0.05] pt-3 mb-4">
              <div className="flex justify-between">
                <span>Último cambio local:</span>
                <span className="font-medium text-text-secondary">{localUpdatedAt}</span>
              </div>
              <div className="flex justify-between">
                <span>Google Cloud:</span>
                <span className="font-medium text-text-secondary">{cloudUserEmail ?? 'No conectado'}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  setSyncPopoverOpen(false)
                  await handleManualSync()
                }}
                disabled={cloudSyncStatus === 'syncing'}
                className="flex-1 min-h-10 rounded-xl bg-text-primary text-white text-xs font-bold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {cloudSyncStatus === 'syncing' ? 'Sincronizando...' : 'Refrescar / Sincronizar'}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )

  const displayIdentities = useMemo(() => {
    let list = travelModeEnabled
      ? identities
          .map((identity) => ({
            ...identity,
            platforms: identity.platforms.filter((platform) => !platform.sensitive),
          }))
          .filter((identity) => identity.platforms.length > 0)
      : identities

    // Sort identities
    list = [...list].sort((a, b) => {
      if (sortMode === 'alpha-asc') {
        return a.email.localeCompare(b.email)
      } else if (sortMode === 'alpha-desc') {
        return b.email.localeCompare(a.email)
      } else if (sortMode === 'created-desc') {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return dateB - dateA
      } else if (sortMode === 'created-asc') {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return dateA - dateB
      } else if (sortMode === 'access-desc') {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return dateB - dateA
      } else if (sortMode === 'usage-desc') {
        return (b.platforms?.length || 0) - (a.platforms?.length || 0) || a.email.localeCompare(b.email)
      }
      return 0
    })

    // Sort platforms within each identity
    return list.map((identity) => {
      const sortedPlatforms = [...identity.platforms].sort((a, b) => {
        if (sortMode === 'alpha-asc') {
          return a.name.localeCompare(b.name)
        } else if (sortMode === 'alpha-desc') {
          return b.name.localeCompare(a.name)
        } else if (sortMode === 'created-desc') {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return dateB - dateA
        } else if (sortMode === 'created-asc') {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return dateA - dateB
        } else if (sortMode === 'access-desc') {
          const dateA = new Date(a.lastAccessedAt || a.updatedAt || a.createdAt || 0).getTime()
          const dateB = new Date(b.lastAccessedAt || b.updatedAt || b.createdAt || 0).getTime()
          return dateB - dateA
        } else if (sortMode === 'usage-desc') {
          return (b.accessCount || 0) - (a.accessCount || 0) || a.name.localeCompare(b.name)
        }
        return 0
      })
      return { ...identity, platforms: sortedPlatforms }
    })
  }, [identities, travelModeEnabled, sortMode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SORT_STORAGE_KEY, sortMode)
  }, [sortMode])

  const displayLocalItems = useMemo(() => {
    return travelModeEnabled
      ? localItems.filter((item) => !item.sensitive)
      : localItems
  }, [localItems, travelModeEnabled])

  const selectedIdentity = useMemo(
    () => displayIdentities.find((identity) => identity.id === selectedId) ?? null,
    [displayIdentities, selectedId],
  )

  const totalAccountCount = useMemo(
    () => displayIdentities.reduce((sum, identity) => sum + (identity.platforms?.length || 0), 0),
    [displayIdentities],
  )

  const globalSearchResults = useMemo(() => {
    const query = globalSearchTerm.trim()
    if (!query) return []

    const results: GlobalSearchResult[] = []
    for (const identity of displayIdentities) {
      if (fuzzyMatch(identity.email, query)) {
        results.push({
          id: `identity-${identity.id}`,
          title: identity.email,
          subtitle: `${identity.platforms.length} plataforma${identity.platforms.length !== 1 ? 's' : ''}`,
          action: () => handleSelect(identity.id),
        })
      }

      for (const platform of identity.platforms) {
        // Excluimos identity.email del haystack de la plataforma para no inundar
        // los resultados con todas las plataformas cuando se busca por el email de la identidad.
        const haystack = [platform.name, platform.username, platform.notes].filter(Boolean).join(' ')
        if (fuzzyMatch(haystack, query)) {
          results.push({
            id: `platform-${identity.id}-${platform.id}`,
            title: platform.name || 'Cuenta sin nombre',
            subtitle: platform.username || identity.email,
            action: () => {
              requestNavigation(() => {
                setGroupMode('identity')
                setSelectedId(identity.id)
                setSelectedPlatformName(null)
                setSelectedLocalCategory(null)
                setSidebarOpen(false)
              })
            },
          })
        }
      }
    }

    for (const item of displayLocalItems) {
      const label = item.categoryLabel?.trim() || LOCAL_ITEM_LABELS[item.type]
      const name = vaultItemDisplayName(item)
      if (fuzzyMatch(`${label} ${name} ${item.title}`, query)) {
        results.push({
          id: `local-${item.id}`,
          title: name,
          subtitle: label,
          action: () => handleSelectLocalCategory({
            id: item.categoryId ?? item.type,
            label,
            type: item.type,
            custom: Boolean(item.categoryId && item.categoryId !== item.type),
          }),
        })
      }
    }

    // Deduplicar resultados exactos (mismo título y subtítulo)
    const uniqueResults: GlobalSearchResult[] = []
    const seen = new Set<string>()
    for (const res of results) {
      const key = `${res.title}::${res.subtitle}`
      if (!seen.has(key)) {
        seen.add(key)
        uniqueResults.push(res)
      }
    }

    return uniqueResults
  }, [displayIdentities, displayLocalItems, globalSearchTerm])


  useEffect(() => {
    if (!isUnlocked) return
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const
    let timer: number | null = null

    const lockVault = () => {
      logoutProfile()
      setSelectedId(null)
      setSelectedPlatformName(null)
      setSelectedLocalCategory(null)
      setGlobalSearchTerm('')
      setLocalSearchTerm('')
    }

    const resetTimer = () => {
      if (timer !== null) window.clearTimeout(timer)
      
      const val = window.localStorage.getItem('contras.autoLockTimeout')
      const timeoutMins = val ? parseInt(val, 10) : 5
      
      if (timeoutMins === 0) return

      timer = window.setTimeout(() => {
        lockVault()
        showToast('Sesión bloqueada automáticamente por inactividad.', 'info')
      }, timeoutMins * 60 * 1000)
    }

    const handleVisibilityChange = () => {
      const blurLockEnabled = window.localStorage.getItem('contras.blurLock') === 'true'
      // @ts-ignore
      const isBiometricActive = window.__biometricPromptOpen
      // @ts-ignore
      const timeSinceBiometric = Date.now() - (window.__lastBiometricPromptClose || 0)
      const recentlyClosedBiometric = timeSinceBiometric < 3000

      if (blurLockEnabled && document.hidden && !isBiometricActive && !recentlyClosedBiometric) {
        lockVault()
        showToast('Sesión bloqueada instantáneamente por desenfoque.', 'info')
      }
    }

    const handleConfigChange = () => {
      resetTimer()
    }

    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }))
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('contras:auto-lock-changed', handleConfigChange)
    window.addEventListener('contras:blur-lock-changed', handleConfigChange)
    
    resetTimer()

    return () => {
      if (timer !== null) window.clearTimeout(timer)
      events.forEach((event) => window.removeEventListener(event, resetTimer))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('contras:auto-lock-changed', handleConfigChange)
      window.removeEventListener('contras:blur-lock-changed', handleConfigChange)
    }
  }, [isUnlocked, logoutProfile, showToast])

  useEffect(() => {
    const handleOpenSettings = () => { setSettingsInitialView('health'); setSettingsOpen(true); }
    const handleClipboardCleared = () => showToast('Portapapeles limpiado por seguridad', 'info')
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        window.dispatchEvent(new Event('contras:lock-vault'))
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (isUnlocked) {
          const searchInput = document.getElementById('global-search-input')
          if (searchInput) searchInput.focus()
        }
      }
      if (e.key === 'Escape') {
        const searchInput = document.getElementById('global-search-input') as HTMLInputElement | null
        if (searchInput && document.activeElement === searchInput) {
          searchInput.value = ''
          searchInput.dispatchEvent(new Event('input', { bubbles: true }))
          searchInput.blur()
        }
      }
    }

    window.addEventListener('contras:open-settings', handleOpenSettings)
    window.addEventListener('clipboard:cleared', handleClipboardCleared)
    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      window.removeEventListener('contras:open-settings', handleOpenSettings)
      window.removeEventListener('clipboard:cleared', handleClipboardCleared)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showToast, isUnlocked])

  useEffect(() => {
    if (!unsavedDirty && !hasUnsyncedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [unsavedDirty, hasUnsyncedChanges])

  useEffect(() => {
    if (!isUnlocked || !currentProfileId || !biometricAvailable || biometricRegistered) return
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem('contras.biometricPromptEnabled') === 'false') return
    if (window.localStorage.getItem(`contras.biometricPromptDismissed.v3.${currentProfileId}`) === 'true') return

    const timer = window.setTimeout(() => setBiometricPromptOpen(true), 1500)
    return () => window.clearTimeout(timer)
  }, [biometricAvailable, biometricRegistered, currentProfileId, isUnlocked])

  const prevMutationCount = useRef(mutationCount)
  useEffect(() => {
    if (mutationCount > prevMutationCount.current) {
      setShowSyncReminder(true)
      setShowSyncCloseWarning(false)
    }
    if (!hasUnsyncedChanges) {
      setShowSyncReminder(false)
      setShowSyncCloseWarning(false)
    }
    prevMutationCount.current = mutationCount
  }, [mutationCount, hasUnsyncedChanges])

  const prevSyncStatusRef = useRef(cloudSyncStatus)
  useEffect(() => {
    if (prevSyncStatusRef.current === 'syncing' && cloudSyncStatus === 'idle' && isOnline) {
      showToast('Bóveda sincronizada correctamente con la nube.', 'success')
    }
    prevSyncStatusRef.current = cloudSyncStatus
  }, [cloudSyncStatus, isOnline, showToast])
  const requestNavigation = (action: () => void) => {
    if (unsavedDirty && unsavedActions) {
      setPendingNavigation(() => action)
      setUnsavedModalOpen(true)
      return
    }

    action()
  }

  const continuePendingNavigation = () => {
    const action = pendingNavigation
    setPendingNavigation(null)
    setUnsavedModalOpen(false)
    if (action) action()
  }

  const handleUnsavedDiscard = () => {
    unsavedActions?.discard()
    setUnsavedDirty(false)
    setUnsavedActions(null)
    continuePendingNavigation()
  }

  const handleLock = () => {
    requestNavigation(() => setLockModalOpen(true))
  }

  useEffect(() => {
    const lockHandler = () => handleLock()
    window.addEventListener('contras:lock-vault', lockHandler)
    return () => window.removeEventListener('contras:lock-vault', lockHandler)
  }, [requestNavigation])

  const handleAddClickRef = useRef(handleAddClick)
  const handleLockRef = useRef(handleLock)
  useEffect(() => {
    handleAddClickRef.current = handleAddClick
    handleLockRef.current = handleLock
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        (activeEl instanceof HTMLElement && activeEl.contentEditable === 'true')
      )

      if (e.key === 'Escape') {
        if (isTyping) {
          (activeEl as HTMLElement).blur()
        } else {
          setSettingsOpen(false)
          setImportTextOpen(false)
          setSelectedId(null)
          setSelectedPlatformName(null)
          setSelectedLocalCategory(null)
          setGlobalSearchTerm('')
          setLocalSearchTerm('')
        }
        return
      }

      if (isTyping) return

      if (e.key === '/') {
        e.preventDefault()
        const searchInput = document.getElementById('global-search-input') || document.querySelector('input[type="search"]')
        if (searchInput) (searchInput as HTMLInputElement).focus()
        return
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        handleAddClickRef.current()
        return
      }

      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        handleLockRef.current()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!mounted || !isReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <p className="text-sm text-text-secondary">Cargando…</p>
      </div>
    )
  }

  // Must be after all hooks — fixes React Error #300
  if (linkData) {
    return (
      <LinkPreview
        linkId={linkData.id}
        base64Key={linkData.key}
        onClose={() => {
          window.location.hash = ''
          setLinkData(null)
        }}
      />
    )
  }

  const warningBanner = null

  if (!isUnlocked) {
    return (
      <div className="flex min-h-dvh flex-col bg-surface">
        {warningBanner}
        <div className="flex-1 flex items-center justify-center">
          <UnlockScreen />
        </div>
      </div>
    )
  }

  const reportUiError = (error: unknown, fallback: string) => {
    const message = getFriendlyErrorMessage(error, fallback)
    showToast(message, 'error')
  }

  const handleUnsavedSave = async () => {
    if (!unsavedActions) return
    setSavingBeforeNavigation(true)
    try {
      await unsavedActions.save()
      setUnsavedDirty(false)
      setUnsavedActions(null)
      continuePendingNavigation()
    } catch (error) {
      reportUiError(error, 'No se pudieron guardar los cambios.')
    } finally {
      setSavingBeforeNavigation(false)
    }
  }

  const handleSelect = (id: string | null) => {
    requestNavigation(() => {
      setSelectedId(id)
      setSelectedPlatformName(null)
      setSelectedLocalCategory(null)
      setGlobalSearchTerm('')
      setSidebarOpen(false)
    })
  }

  const handleSelectPlatform = (platformName: string | null) => {
    requestNavigation(() => {
      setSelectedPlatformName(platformName)
      setSelectedId(null)
      setSelectedLocalCategory(null)
      setGlobalSearchTerm('')
      setSidebarOpen(false)
    })
  }

  const handleGroupModeChange = (mode: VaultGroupMode) => {
    requestNavigation(() => {
      setGroupMode(mode)
      setGlobalSearchTerm('')
      setLocalSearchTerm('')
      setSelectedId(null)
      setSelectedPlatformName(null)
      setSelectedLocalCategory(null)
    })
  }

  const handleSelectLocalCategory = (category: LocalCategory | null) => {
    requestNavigation(() => {
      setSelectedLocalCategory(category)
      setSelectedId(null)
      setSelectedPlatformName(null)
      setGlobalSearchTerm('')
      setSidebarOpen(false)
    })
  }

  const dismissBiometricPrompt = () => {
    if (currentProfileId) {
      window.localStorage.setItem(`contras.biometricPromptDismissed.v3.${currentProfileId}`, 'true')
    }
    setBiometricPromptOpen(false)
  }

  const handleRegisterBiometric = async (masterPassword: string) => {
    await registerBiometricUnlock(masterPassword)
    if (currentProfileId) {
      window.localStorage.setItem(`contras.biometricPromptDismissed.v3.${currentProfileId}`, 'true')
    }
    setBiometricPromptOpen(false)
  }
  const handleRegisterHardwareKey = async (masterPassword: string) => {
    await registerHardwareKeyUnlock(masterPassword)
  }

  const handleManualSync = async () => {
    showToast('Sincronizando con Google Cloud...', 'info')
    try {
      const result = await syncActiveProfileToCloud()
      if (result.action === 'download_available') {
        setPendingCloudDownload(result)
        return
      }
      showToast(result.message, result.action === 'idle' ? 'info' : 'success')
    } catch (error) {
      reportUiError(error, 'No se pudo sincronizar la bóveda.')
    }
  }

  const handleConfirmCloudDownload = async (resolutions?: Record<string, 'local' | 'cloud'>) => {
    setDownloadingCloud(true)
    try {
      const result = await downloadLatestCloudVault(resolutions)
      setPendingCloudDownload(null)
      showToast(result.message, 'success')
    } catch (error) {
      reportUiError(error, 'No se pudo descargar la bóveda desde la nube.')
    } finally {
      setDownloadingCloud(false)
    }
  }

  const enableTravelMode = () => {
    setTravelModeEnabled(true)
    window.sessionStorage.setItem('contras.travelMode', '1')
    setSelectedId(null)
    setSelectedPlatformName(null)
    setSelectedLocalCategory(null)
    setGlobalSearchTerm('')
    setLocalSearchTerm('')
    showToast('Modo Viaje activado. Las cuentas sensibles quedan ocultas hasta verificar la Contraseña Maestra.', 'info')
  }

  const disableTravelMode = async (masterPassword: string) => {
    const verified = await verifyCurrentMasterPassword(masterPassword)
    if (!verified) throw new Error('Contraseña Maestra incorrecta.')
    setTravelModeEnabled(false)
    window.sessionStorage.removeItem('contras.travelMode')
    showToast('Modo Viaje desactivado. La bóveda completa vuelve a estar visible.', 'success')
  }

  const confirmLock = () => {
    setLockModalOpen(false)
    logoutProfile()
    setSelectedId(null)
    setSelectedPlatformName(null)
    setSelectedLocalCategory(null)
    setGlobalSearchTerm('')
    setLocalSearchTerm('')
  }

  const handleDeleteIdentity = async (id: string) => {
    try {
      await deleteIdentity(id)
      if (selectedId === id) {
        setSelectedId(null)
      }
    } catch (error) {
      reportUiError(error, 'No se pudo eliminar la identidad.')
    }
  }

  const handleExportBackup = async (password: string) => {
    const backupJsonString = await exportBackup(password)
    const blob = new Blob([backupJsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `contras_backup_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleImportBackup = async (backupJsonString: string, password: string) => {
    await importBackup(backupJsonString, password)
    setSelectedId(null)
    setSelectedPlatformName(null)
  }

  const isInsideView = selectedId !== null || selectedPlatformName !== null || selectedLocalCategory !== null
  // La barra de búsqueda extra en móvil siempre se muestra
  const showExtraHeaderElements = true

  const mobileTopBar = isMobile ? (
    <div className="relative shrink-0 z-50 flex flex-col bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-black/5 dark:border-white/5 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] gap-3">
      {/* Row 1: Title & Sync indicator */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-text-primary dark:text-white">Contras</p>
          <div className="mt-0.5 flex min-w-0 items-baseline gap-2">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary dark:text-slate-400">
              {currentProfileName ?? 'Bóveda Principal'}
            </p>
            <span className="shrink-0 text-xs font-bold tabular-nums text-text-primary dark:text-white">
              {totalAccountCount} cuenta{totalAccountCount !== 1 ? 's' : ''} guardada{totalAccountCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Sync indicator only */}
          {CloudSyncIndicator && <div className="flex items-center">{CloudSyncIndicator}</div>}
          {/* Add button */}
          <button
            type="button"
            onClick={handleAddClick}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/5 bg-white dark:bg-slate-800 text-text-secondary dark:text-slate-400 shadow-sm transition-all active:scale-[0.96]"
            aria-label="Añadir"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
          
          <div className="relative shrink-0 flex items-center">
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.06] bg-indigo-50 text-indigo-700 font-bold text-[10px] shadow-sm hover:bg-indigo-100 transition-all active:scale-95"
              aria-label="Menú de usuario"
            >
              {(currentProfileName || cloudUserEmail || 'U').charAt(0).toUpperCase()}
              {inboxCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
                  {inboxCount}
                </span>
              )}
            </button>
            {showUserMenu && (
              <>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowUserMenu(false)}
                  className="fixed inset-0 z-40 cursor-default bg-transparent outline-none"
                />
                <div className="absolute right-0 top-[110%] z-50 w-64 rounded-3xl border border-black/5 bg-white/95 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur-xl text-left flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200 dark:border-white/10 dark:bg-slate-900/95">
                  <div className="px-3 py-3 border-b border-black/5 mb-1 bg-slate-50/50 rounded-2xl dark:border-white/5 dark:bg-slate-800/50">
                    <p className="text-sm font-bold text-slate-900 truncate dark:text-white">{currentProfileName || 'Bóveda Local'}</p>
                    <p className="text-[11px] text-slate-500 truncate font-medium mt-0.5">{cloudUserEmail}</p>
                  </div>
                  <button type="button" onClick={() => { setShowUserMenu(false); setSettingsOpen(true) }} className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                    </div>
                    Mi Perfil y Ajustes
                  </button>
                  <button type="button" onClick={() => { setShowUserMenu(false); setInboxModalOpen(true) }} className="flex items-center justify-between w-full rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                      </div>
                      Buzón
                    </div>
                    {inboxCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">{inboxCount}</span>}
                  </button>
                  <div className="h-px bg-black/5 my-1 mx-2 dark:bg-white/5"></div>
                  <button type="button" onClick={() => { setShowUserMenu(false); handleLock() }} className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-[13px] font-semibold text-red-600 hover:bg-red-50 transition-colors dark:hover:bg-red-900/20">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                    </div>
                    Cerrar y Bloquear
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Search input (only on list view) */}
      {showExtraHeaderElements && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="search"
              value={localSearchTerm}
              onChange={(event) => setLocalSearchTerm(event.target.value)}
              placeholder={selectedId ? 'Buscar en esta identidad...' : selectedPlatformName ? 'Buscar cuentas...' : 'Buscar...'}
              className="h-10 w-full rounded-xl border border-black/[0.06] dark:border-white/10 bg-white/90 dark:bg-slate-800/90 pl-9 pr-12 text-base font-medium text-text-primary dark:text-white shadow-subtle outline-none backdrop-blur-xl transition-all placeholder:text-text-tertiary dark:placeholder-slate-400 focus:border-black/15 focus:bg-white dark:focus:bg-slate-800"
              aria-label="Búsqueda local de la sección"
            />
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowMobileSortMenu((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.06] bg-white dark:bg-slate-800 text-text-secondary dark:text-slate-400 shadow-subtle transition-all active:scale-[0.95]"
              aria-label="Ordenar lista"
              title={`Ordenar: ${SORT_LABELS[sortMode]}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h18M3 12h18M3 19.5h18" />
              </svg>
            </button>

            {showMobileSortMenu && (
              <>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowMobileSortMenu(false)}
                  className="fixed inset-0 z-40 cursor-default bg-transparent outline-none"
                />
                <div className="absolute right-0 mt-2 z-50 w-56 rounded-2xl border border-black/5 bg-white/95 dark:bg-slate-800/95 dark:border-white/10 p-1.5 shadow-[0_15px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl text-left">
                  <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-text-tertiary">
                    Ordenar por
                  </div>
                  {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setSortMode(mode)
                        setShowMobileSortMenu(false)
                      }}
                      className={`flex min-h-10 w-full items-center justify-between rounded-xl px-3 text-xs font-semibold transition-colors ${
                        sortMode === mode
                          ? 'bg-text-primary text-white'
                          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary dark:text-slate-300 dark:hover:bg-slate-700'
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
      )}

      {/* Row 3: Group Mode Toggle */}
      {showExtraHeaderElements && !isInsideView && (
        <div className="grid grid-cols-3 rounded-xl border border-black/[0.06] bg-surface-elevated p-1 shadow-subtle dark:border-white/10 dark:bg-[#1c1c1e] shrink-0">
          {(['identity', 'platform', 'local'] as VaultGroupMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                requestNavigation(() => {
                  setGroupMode(mode)
                  setSelectedId(null)
                  setSelectedPlatformName(null)
                  setSelectedLocalCategory(null)
                })
              }}
              className={`min-h-8 rounded-lg px-2 py-1 text-[11px] font-bold transition-all duration-150 ${
                groupMode === mode && selectedId === null && selectedLocalCategory === null && selectedPlatformName === null
                  ? 'bg-text-primary text-white shadow-[0_8px_22px_rgba(15,23,42,0.14)] dark:bg-slate-700'
                  : 'text-text-secondary hover:bg-surface-hover dark:text-[#a0a0a5] dark:hover:bg-slate-800/50'
              }`}
            >
              {mode === 'identity' ? 'Identidades' : mode === 'platform' ? 'Plataformas' : 'Locales'}
            </button>
          ))}
        </div>
      )}
    </div>
  ) : null
  const globalOverlays = null

  const biometricOnboardingModal = biometricPromptOpen ? (
    <div className="fixed bottom-4 left-1/2 z-[100] w-full max-w-sm -translate-x-1/2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:translate-x-0">
      <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-white dark:bg-slate-800 dark:border-white/10 p-4 shadow-xl ring-1 ring-black/5 dark:ring-white/5 animate-vault-slide-up">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 11.25v1.5m-6.364 4.864a9 9 0 1112.728 0M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-text-primary">¿Entrar más rápido?</h3>
            <p className="mt-1 text-xs text-text-secondary">Activa el desbloqueo por huella o cara para no tener que escribir tu contraseña maestra.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSettingsInitialView('biometric')
                  setSettingsOpen(true)
                  dismissBiometricPrompt()
                }}
                className="flex h-8 items-center justify-center rounded-lg bg-text-primary px-3 text-xs font-semibold text-white transition-transform hover:scale-105 active:scale-95"
              >
                Configurar
              </button>
              <button
                type="button"
                onClick={dismissBiometricPrompt}
                className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-black/5 active:bg-black/10"
              >
                Ignorar
              </button>
              <button
                type="button"
                onClick={() => {
                  window.localStorage.setItem('contras.biometricPromptEnabled', 'false')
                  setBiometricPromptOpen(false)
                  window.alert("Se ha ocultado la sugerencia. Si cambias de opinión, puedes activarlo manualmente en Ajustes.")
                }}
                className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                title="Desactivar sugerencia (puedes configurarlo en Ajustes)"
              >
                No sugerir más
              </button>
            </div>
          </div>
          <button type="button" onClick={dismissBiometricPrompt} className="absolute right-2 top-2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  ) : null

  const syncReminderModal = showSyncReminder ? (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-white/50 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-6 shadow-[0_34px_100px_rgba(15,23,42,0.25)] backdrop-blur-xl animate-vault-morph">
        {showSyncCloseWarning ? (
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">¿Cerrar sin sincronizar?</h3>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                Si cierras, tus cambios solo se guardarán localmente en este dispositivo.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-red-600 dark:text-red-400 font-semibold">
                Nota para Safari / iOS: El navegador puede borrar automáticamente todos los datos locales después de unos días de inactividad. Si no sincronizas con la nube, podrías perder estos cambios de forma permanente.
              </p>
            </div>
            <div className="mt-4 flex gap-3">
              {cloudUserEmail ? (
                <button
                  type="button"
                  onClick={handleManualSync}
                  className="flex h-10 flex-1 items-center justify-center rounded-xl bg-text-primary text-xs font-semibold text-white hover:opacity-90 active:scale-95 transition-all"
                >
                  Sincronizar ahora
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(true)
                    setShowSyncReminder(false)
                    setShowSyncCloseWarning(false)
                  }}
                  className="flex h-10 flex-1 items-center justify-center rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 active:scale-95 transition-all"
                >
                  Hacer Copia Manual (Ajustes)
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowSyncReminder(false)
                  setShowSyncCloseWarning(false)
                }}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-border bg-transparent text-xs font-medium text-text-secondary hover:bg-black/5 active:scale-95 transition-all"
              >
                Ignorar y cerrar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {cloudUserEmail ? (
                cloudSyncStatus === 'syncing' ? (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 animate-spin">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </div>
                ) : cloudSyncStatus === 'error' ? (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold text-text-primary">
                  {cloudUserEmail ? 'Sincronización de Bóveda' : 'Cambios guardados localmente'}
                </h3>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {cloudUserEmail 
                    ? cloudSyncStatus === 'syncing' 
                      ? 'Subiendo cambios a la nube...' 
                      : cloudSyncStatus === 'error' 
                        ? 'Error al sincronizar con Google Cloud.' 
                        : 'Bóveda completamente al día.'
                    : 'Tus datos se guardaron localmente en el dispositivo.'}
                </p>
              </div>
            </div>
            
            <p className="text-[11px] leading-relaxed text-text-tertiary">
              {cloudUserEmail
                ? 'Los cambios se subirán para estar disponibles en todos tus dispositivos y evitar pérdidas de datos en navegadores con almacenamiento volátil.'
                : 'No tienes una cuenta de Google conectada. Recuerda que en Safari PWA, iOS puede borrar tus datos locales automáticamente tras unos días de inactividad. Te aconsejamos conectar una cuenta o exportar una copia.'}
            </p>

            <div className="mt-4 flex gap-2 justify-end">
              {cloudUserEmail ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowSyncCloseWarning(true)}
                    className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold text-text-secondary hover:bg-black/5"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={cloudSyncStatus === 'syncing'}
                    className="flex h-8 items-center justify-center rounded-lg bg-text-primary px-4 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {cloudSyncStatus === 'syncing' ? 'Sincronizando...' : 'Sincronizar ahora'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowSyncCloseWarning(true)}
                    className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold text-text-secondary hover:bg-black/5"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(true)
                      setShowSyncReminder(false)
                    }}
                    className="flex h-8 items-center justify-center rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    Ver Ajustes / Backup
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  ) : null

  const cloudDownloadModal = pendingCloudDownload ? (
    pendingCloudDownload.diffResult ? (
      <SyncDiffViewer
        diffResult={pendingCloudDownload.diffResult}
        onConfirm={handleConfirmCloudDownload}
        onCancel={() => setPendingCloudDownload(null)}
        isDownloading={downloadingCloud}
      />
    ) : (
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-fade-in w-full max-w-[100vw] overflow-x-hidden">
        <div className="w-full max-w-lg rounded-3xl border border-white/50 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-6 shadow-[0_34px_100px_rgba(15,23,42,0.25)] backdrop-blur-xl animate-vault-morph overflow-x-hidden max-w-[100vw]">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-2.25 2.25M12 9.75l2.25 2.25M6.75 18.75h10.5a3.75 3.75 0 00.98-7.37A6.001 6.001 0 006.36 9.18a4.5 4.5 0 00.39 9.57z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold tracking-tight text-text-primary">Hay datos nuevos en la nube</h3>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{pendingCloudDownload.message}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-black/[0.06] bg-surface p-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">Este dispositivo</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">{pendingCloudDownload.localPlatformCount ?? 0} contraseñas</p>
              <p className="text-xs text-text-tertiary">{pendingCloudDownload.localLocalItemCount ?? 0} secretos locales</p>
              <p className="text-xs text-text-tertiary">{pendingCloudDownload.localLocalCategoryCount ?? 0} secciones</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">Google Cloud</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">{pendingCloudDownload.cloudPlatformCount ?? 0} contraseñas</p>
              <p className="text-xs text-text-tertiary">{pendingCloudDownload.cloudLocalItemCount ?? 0} secretos locales</p>
              <p className="text-xs text-text-tertiary">{pendingCloudDownload.cloudLocalCategoryCount ?? 0} secciones</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end w-full">
            <button
              type="button"
              onClick={() => setPendingCloudDownload(null)}
              disabled={downloadingCloud}
              className="flex-1 sm:flex-none min-h-11 rounded-xl border border-black/5 bg-surface px-4 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-60"
            >
              Ahora no
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmCloudDownload()}
              disabled={downloadingCloud}
              className="flex-1 sm:flex-none min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-60"
            >
              {downloadingCloud ? 'Descargando...' : 'Descargar de la nube'}
            </button>
          </div>
        </div>
      </div>
    )
  ) : null

  const desktopToolbar = (
    <header className="sticky top-0 z-40 flex min-h-20 items-center gap-3 border-b border-border-subtle bg-white/82 px-5 py-3 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl lg:px-8 dark:border-white/5 dark:bg-slate-900/80">
      <GlobalSearch
        query={globalSearchTerm}
        onQueryChange={setGlobalSearchTerm}
        results={globalSearchResults}
        syncing={cloudSyncStatus === 'syncing'}
        className="min-w-[280px] flex-1 max-w-2xl"
      />

      <div className="relative shrink-0 flex items-center">
        <button
          type="button"
          onClick={() => setShowDesktopSortMenu(!showDesktopSortMenu)}
          className="flex h-12 items-center gap-2 rounded-2xl border border-black/[0.06] bg-white px-4 text-xs font-bold text-text-secondary shadow-subtle outline-none transition-all hover:bg-surface-hover hover:text-text-primary dark:border-white/10 dark:bg-slate-800 dark:hover:bg-slate-700"
          title={`Ordenar: ${SORT_LABELS[sortMode]}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h18M3 12h18M3 19.5h18" />
          </svg>
          <span className="hidden xl:inline">{SORT_LABELS[sortMode]}</span>
        </button>
        {showDesktopSortMenu && (
          <>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowDesktopSortMenu(false)}
              className="fixed inset-0 z-40 cursor-default bg-transparent outline-none"
            />
            <div className="absolute right-0 top-[110%] z-50 w-56 rounded-2xl border border-black/5 bg-white/95 p-1.5 shadow-[0_15px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl text-left dark:border-white/10 dark:bg-slate-900/95">
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-text-tertiary dark:text-slate-500">
                Ordenar por
              </div>
              {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setSortMode(mode)
                    setShowDesktopSortMenu(false)
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

      <div className="relative shrink-0 flex items-center">
        <button
          type="button"
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-black/[0.06] bg-indigo-50 text-indigo-700 font-bold text-sm shadow-[0_4px_10px_rgba(0,0,0,0.03)] hover:bg-indigo-100 hover:shadow-md transition-all active:scale-95 ml-2"
          aria-label="Menú de usuario"
        >
          {(currentProfileName || cloudUserEmail || 'U').charAt(0).toUpperCase()}
          {inboxCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
              {inboxCount}
            </span>
          )}
        </button>
        {showUserMenu && (
          <>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowUserMenu(false)}
              className="fixed inset-0 z-40 cursor-default bg-transparent outline-none"
            />
            <div className="absolute right-0 top-[110%] z-50 w-64 rounded-3xl border border-black/5 bg-white/95 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur-xl text-left flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200 dark:border-white/10 dark:bg-slate-900/95">
              <div className="px-3 py-3 border-b border-black/5 mb-1 bg-slate-50/50 rounded-2xl dark:border-white/5 dark:bg-slate-800/50">
                <p className="text-sm font-bold text-slate-900 truncate">{currentProfileName || 'Bóveda Local'}</p>
                <p className="text-[11px] text-slate-500 truncate font-medium mt-0.5">{cloudUserEmail}</p>
              </div>
              
              <button
                type="button"
                onClick={() => { setShowUserMenu(false); setSettingsOpen(true) }}
                className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                Mi Perfil y Ajustes
              </button>

              <button
                type="button"
                onClick={() => { setShowUserMenu(false); setInboxModalOpen(true) }}
                className="flex items-center justify-between w-full rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  Buzón
                </div>
                {inboxCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                    {inboxCount}
                  </span>
                )}
              </button>



              <button
                type="button"
                onClick={() => { setShowUserMenu(false); void handleManualSync() }}
                className="flex items-center justify-between w-full rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <svg className={`h-4 w-4 ${cloudSyncStatus === 'syncing' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </div>
                  Sincronización
                </div>
                {cloudSyncStatus === 'synced' && <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></div>}
                {cloudSyncStatus === 'error' && <div className="h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white animate-pulse"></div>}
              </button>
              
              <div className="h-px bg-black/5 my-1 mx-2"></div>
              
              <button
                type="button"
                onClick={() => { setShowUserMenu(false); handleLock() }}
                className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-[13px] font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-red-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                Bloquear Bóveda
              </button>

            </div>
          </>
        )}
      </div>
    </header>
  )

  if (isMobile) {
    return (
      <div className="fixed inset-0 flex h-dvh max-h-dvh flex-col overflow-hidden bg-surface overscroll-none">
        {mobileTopBar}
        {globalOverlays}
        <div className={`flex min-h-0 flex-1 flex-col overflow-hidden pb-4`}>
          {selectedId === null && selectedLocalCategory === null && selectedPlatformName === null ? (
            <Sidebar
              identities={displayIdentities}
              localItems={displayLocalItems}
              groupMode={groupMode}
              selectedId={selectedId}
              selectedPlatformName={selectedPlatformName}
              selectedLocalCategory={selectedLocalCategory}
              searchQuery={localSearchTerm}
              onGroupModeChange={handleGroupModeChange}
              onSelect={handleSelect}
              onSelectPlatform={handleSelectPlatform}
              onSelectLocalCategory={handleSelectLocalCategory}
              onAddIdentity={async (email) => {
                const identity = await addIdentity(email)
                requestNavigation(() => {
                  setSelectedId(identity.id)
                  setSelectedPlatformName(null)
                  setSelectedLocalCategory(null)
                })
              }}
              onDeleteIdentity={handleDeleteIdentity}
              onLock={handleLock}
              onSync={() => void handleManualSync()}
              isOpen={false}
              onClose={() => {}}
              onOpenSettings={() => setSettingsOpen(true)}
              profileName={currentProfileName}
              isMobile={true}
              installPromptAvailable={Boolean(deferredPrompt)}
              onInstall={handleInstallApp}
              syncing={cloudSyncStatus === 'syncing'}
              syncIndicator={CloudSyncIndicator}
              showAddForm={showAddForm}
              onToggleAddForm={handleToggleAddForm}
              onAddClick={handleAddClick}
              sortMode={sortMode}
              onSortModeChange={setSortMode}
            />
          ) : (
            <MainArea
              identities={displayIdentities}
              identity={selectedIdentity}
              groupMode={groupMode}
              selectedPlatformName={selectedPlatformName}
              localCategory={selectedLocalCategory}
              localItems={displayLocalItems}
              onOpenSidebar={() => {}}
              onRequestNavigation={requestNavigation}
              onUnsavedStateChange={(dirty, actions) => {
                setUnsavedDirty(dirty)
                setUnsavedActions(actions)
              }}
              onSelectIdentity={(id) => {
                requestNavigation(() => {
                  setSelectedId(id)
                  setSelectedPlatformName(null)
                  setSelectedLocalCategory(null)
                })
              }}
              onSelectPlatformName={(platformName) => {
                requestNavigation(() => {
                  setSelectedPlatformName(platformName)
                  setSelectedId(null)
                  setSelectedLocalCategory(null)
                })
              }}
              onSelectLocalCategory={handleSelectLocalCategory}
              onOpenImportText={() => setImportTextOpen(true)}
              onCreate={handleAddClick}
              onAddPlatform={addPlatform}
              onUpdatePlatform={updatePlatform}
              onDeletePlatform={deletePlatform}
              onSaveLocalItem={saveLocalItem}
              onDeleteLocalItem={deleteLocalItem}
              isMobile={true}
              createTrigger={createTrigger}
              onCreateHandled={() => setCreateTrigger(0)}
              editPlatformTrigger={editPlatformTrigger}
              onEditPlatformHandled={clearEditPlatformTrigger}
              sortMode={sortMode}
              searchQuery={localSearchTerm}
              onVerifyMasterPassword={verifyCurrentMasterPassword}
            />
          )}
        </div>

        {/* Bottom bar removed and moved to mobileTopBar */}

        <SettingsModal
          initialView={settingsInitialView}
          onEditPlatform={(platformId) => {
            const identity = identities.find(id => id.platforms.some(p => p.id === platformId))
            if (identity) {
              setSelectedId(identity.id)
              setSelectedPlatformName(identity.platforms.find(p => p.id === platformId)?.name || null)
              setEditPlatformTrigger(platformId)
              setSettingsOpen(false)
            }
          }}
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onExport={handleExportBackup}
          identities={identities}
          localItems={localItems}
          onVerifyMasterPassword={verifyCurrentMasterPassword}
          onChangeMasterPassword={changeCurrentMasterPassword}
          travelModeEnabled={travelModeEnabled}
          onEnableTravelMode={enableTravelMode}
          onDisableTravelMode={disableTravelMode}
          onImport={handleImportBackup}
          onOpenImportText={() => setImportTextOpen(true)}
          biometricAvailable={biometricAvailable}
          biometricRegistered={biometricRegistered}
          onRegisterBiometric={handleRegisterBiometric}
          onDisableBiometric={disableBiometricUnlock}
          hardwareKeyAvailable={hardwareKeyAvailable}
          hardwareKeyRegistered={hardwareKeyRegistered}
          onRegisterHardwareKey={handleRegisterHardwareKey}
          onDisableHardwareKey={disableHardwareKeyUnlock}
          onUpdatePlatform={updatePlatform}
        />

        <ImportTextModal
          isOpen={importTextOpen}
          onClose={() => setImportTextOpen(false)}
          onImport={async (rows) => {
            const identityId = await importMassiveAccounts(rows)
            if (identityId) {
              setSelectedId(identityId)
              setSelectedPlatformName(null)
              setSelectedLocalCategory(null)
            }
          }}
        />

        <InboxModal 
          isOpen={inboxModalOpen} 
          onClose={() => setInboxModalOpen(false)} 
        />

        <IOSInstallPrompt />
        {biometricOnboardingModal}
        {cloudDownloadModal}
        {syncReminderModal}

        {unsavedModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-md rounded-3xl border border-white/50 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-6 shadow-[0_34px_100px_rgba(15,23,42,0.25)] backdrop-blur-xl animate-vault-morph">
              <h3 className="text-xl font-bold tracking-tight text-text-primary">Tienes cambios sin guardar</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">¿Quieres guardarlos antes de salir?</p>
              <div className="mt-6 grid gap-2">
                <button type="button" onClick={() => void handleUnsavedSave()} disabled={savingBeforeNavigation} className="min-h-12 rounded-xl bg-text-primary px-4 text-sm font-semibold text-white disabled:opacity-60">
                  {savingBeforeNavigation ? 'Guardando…' : 'Guardar'}
                </button>
                <button type="button" onClick={() => { setUnsavedModalOpen(false); setPendingNavigation(null) }} className="min-h-12 rounded-xl border border-black/5 bg-surface px-4 text-sm font-semibold text-text-secondary">
                  Cancelar
                </button>
                <button type="button" onClick={handleUnsavedDiscard} className="min-h-12 rounded-xl border border-red-100 bg-red-50 px-4 text-sm font-semibold text-red-700">
                  Descartar cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {lockModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-lg rounded-3xl border border-white/50 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-6 shadow-[0_34px_100px_rgba(15,23,42,0.25)] backdrop-blur-xl animate-vault-morph">
              {hasUnsyncedChanges ? (
                <>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700 ring-1 ring-red-100">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-red-600">Alerta Crítica de Sincronización</h3>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">Tienes cambios recientes que no se han podido subir a la nube. Si sales ahora, perderás estos datos en tus otros dispositivos.</p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold tracking-tight text-text-primary">Vas a bloquear tu bóveda</h3>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">Necesitarás tu Contraseña Maestra para volver a entrar. ¿Estás seguro de que la recuerdas?</p>
                </>
              )}
              <div className="mt-6 flex flex-col gap-2">
                {hasUnsyncedChanges ? (
                  <button type="button" onClick={() => { setLockModalOpen(false); setFocusCsvExport(true); setSettingsOpen(true) }} className="min-h-12 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-800">
                    Descargar copia local (Cifrada/CSV) para no perder datos
                  </button>
                ) : (
                  <button type="button" onClick={() => { setLockModalOpen(false); setFocusCsvExport(true); setSettingsOpen(true) }} className="min-h-12 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800">
                    Descargar copia de seguridad (CSV) por si acaso
                  </button>
                )}
                <button type="button" onClick={() => setLockModalOpen(false)} className="min-h-12 rounded-xl border border-black/5 bg-surface px-4 text-sm font-semibold text-text-secondary">
                  Cancelar
                </button>
                <button type="button" onClick={confirmLock} className={`min-h-12 rounded-xl px-4 text-sm font-semibold text-white ${hasUnsyncedChanges ? 'bg-red-600 hover:bg-red-700' : 'bg-text-primary'}`}>
                  Sí, bloquear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-surface overscroll-none overflow-hidden">
      {warningBanner}
      <div className="flex flex-1 min-h-0">
        {globalOverlays}
        <Sidebar
          identities={displayIdentities}
          localItems={displayLocalItems}
          groupMode={groupMode}
          selectedId={selectedId}
          selectedPlatformName={selectedPlatformName}
          selectedLocalCategory={selectedLocalCategory}
          searchQuery={localSearchTerm}
          onGroupModeChange={handleGroupModeChange}
          onSelect={handleSelect}
          onSelectPlatform={handleSelectPlatform}
          onSelectLocalCategory={handleSelectLocalCategory}
          onAddIdentity={async (email) => {
            const identity = await addIdentity(email)
            requestNavigation(() => {
              setSelectedId(identity.id)
              setSelectedPlatformName(null)
              setSelectedLocalCategory(null)
            })
          }}
          onDeleteIdentity={handleDeleteIdentity}
          onLock={handleLock}
          onSync={() => void handleManualSync()}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
          profileName={currentProfileName}
          isMobile={false}
          installPromptAvailable={Boolean(deferredPrompt)}
          onInstall={handleInstallApp}
          syncing={cloudSyncStatus === 'syncing'}
          syncIndicator={CloudSyncIndicator}
          showAddForm={showAddForm}
          onToggleAddForm={handleToggleAddForm}
          onAddClick={handleAddClick}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
        />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-elevated dark:bg-slate-950 lg:rounded-l-2xl lg:border-l lg:border-border-subtle dark:lg:border-white/5">
          {desktopToolbar}
          <MainArea
            identities={displayIdentities}
            identity={selectedIdentity}
            groupMode={groupMode}
            selectedPlatformName={selectedPlatformName}
            syncing={cloudSyncStatus === 'syncing'}
            localCategory={selectedLocalCategory}
            localItems={displayLocalItems}
            onOpenSidebar={() => setSidebarOpen(true)}
            onRequestNavigation={requestNavigation}
            onUnsavedStateChange={(dirty, actions) => {
              setUnsavedDirty(dirty)
              setUnsavedActions(actions)
            }}
            onSelectIdentity={(id) => {
              requestNavigation(() => {
                setSelectedId(id)
                setSelectedPlatformName(null)
                setSelectedLocalCategory(null)
              })
            }}
            onSelectPlatformName={(platformName) => {
              requestNavigation(() => {
                setSelectedPlatformName(platformName)
                setSelectedId(null)
                setSelectedLocalCategory(null)
              })
            }}
            onSelectLocalCategory={handleSelectLocalCategory}
            onOpenImportText={() => setImportTextOpen(true)}
            onCreate={handleAddClick}
            onAddPlatform={addPlatform}
            onUpdatePlatform={updatePlatform}
            onDeletePlatform={deletePlatform}
            onSaveLocalItem={saveLocalItem}
            onDeleteLocalItem={deleteLocalItem}
            isMobile={false}
            createTrigger={createTrigger}
            onCreateHandled={() => setCreateTrigger(0)}
            editPlatformTrigger={editPlatformTrigger}
            onEditPlatformHandled={clearEditPlatformTrigger}
            sortMode={sortMode}
            searchQuery={globalSearchTerm}
            onVerifyMasterPassword={verifyCurrentMasterPassword}
          />
        </main>
      </div>

      <SettingsModal
        initialView={settingsInitialView}
        onEditPlatform={(platformId) => {
          const identity = identities.find(id => id.platforms.some(p => p.id === platformId))
          if (identity) {
            setSelectedId(identity.id)
            setSelectedPlatformName(identity.platforms.find(p => p.id === platformId)?.name || null)
            setEditPlatformTrigger(platformId)
            setSettingsOpen(false)
            setTimeout(() => setEditPlatformTrigger(null), 100)
          }
        }}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onExport={handleExportBackup}
        identities={identities}
        localItems={localItems}
        onVerifyMasterPassword={verifyCurrentMasterPassword}
        onChangeMasterPassword={changeCurrentMasterPassword}
        travelModeEnabled={travelModeEnabled}
        onEnableTravelMode={enableTravelMode}
        onDisableTravelMode={disableTravelMode}
        onImport={handleImportBackup}
        onOpenImportText={() => setImportTextOpen(true)}
        biometricAvailable={biometricAvailable}
        biometricRegistered={biometricRegistered}
        onRegisterBiometric={handleRegisterBiometric}
        onDisableBiometric={disableBiometricUnlock}
        hardwareKeyAvailable={hardwareKeyAvailable}
        hardwareKeyRegistered={hardwareKeyRegistered}
        onRegisterHardwareKey={handleRegisterHardwareKey}
        onDisableHardwareKey={disableHardwareKeyUnlock}
        focusCsvExport={focusCsvExport}
        onCsvExportFocused={() => setFocusCsvExport(false)}
        onUpdatePlatform={updatePlatform}
      />

      <ImportTextModal
        isOpen={importTextOpen}
        onClose={() => setImportTextOpen(false)}
        onImport={async (rows) => {
          const identityId = await importMassiveAccounts(rows)
          if (identityId) {
            setSelectedId(identityId)
            setSelectedPlatformName(null)
            setSelectedLocalCategory(null)
          }
        }}
      />

      <IOSInstallPrompt />
      {biometricOnboardingModal}
      {cloudDownloadModal}
      {syncReminderModal}

      {unsavedModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-white/50 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-6 shadow-[0_34px_100px_rgba(15,23,42,0.25)] backdrop-blur-xl animate-vault-morph">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM10.29 3.86L1.82 18a2.25 2.25 0 001.93 3.375h16.5A2.25 2.25 0 0022.18 18L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-text-primary">Tienes cambios sin guardar</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Si sales ahora, los cambios de esta cuenta se perderán. Puedes guardarlos antes de cambiar de vista.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={handleUnsavedDiscard}
                className="min-h-11 rounded-xl border border-red-100 bg-red-50 px-4 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
              >
                Descartar cambios
              </button>
              <button
                type="button"
                onClick={() => {
                  setUnsavedModalOpen(false)
                  setPendingNavigation(null)
                }}
                className="min-h-11 rounded-xl border border-black/5 bg-surface px-4 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-hover"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleUnsavedSave()}
                disabled={savingBeforeNavigation}
                className="min-h-11 rounded-xl bg-text-primary px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all hover:-translate-y-0.5 disabled:opacity-60"
              >
                {savingBeforeNavigation ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lockModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-white/50 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-6 shadow-[0_34px_100px_rgba(15,23,42,0.25)] backdrop-blur-xl animate-vault-morph">
            {hasUnsyncedChanges ? (
              <>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700 ring-1 ring-red-100">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold tracking-tight text-red-600">Alerta Crítica de Sincronización</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">Tienes cambios recientes que no se han podido subir a la nube. Si sales ahora, perderás estos datos en tus otros dispositivos.</p>
              </>
            ) : (
              <>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-text-primary ring-1 ring-black/5">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold tracking-tight text-text-primary">Vas a bloquear tu bóveda</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">Necesitarás tu Contraseña Maestra para volver a entrar. Confirma que la recuerdas antes de cerrar la sesión segura.</p>
              </>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              {hasUnsyncedChanges ? (
                <button type="button" onClick={() => { setLockModalOpen(false); setSettingsOpen(true) }} className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-800 transition-colors hover:bg-red-100">
                  Descargar copia local (Cifrada/CSV) para no perder datos
                </button>
              ) : (
                <button type="button" onClick={() => { setLockModalOpen(false); setSettingsOpen(true) }} className="min-h-11 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100">
                  Descargar copia de seguridad (CSV) por si acaso
                </button>
              )}
              <button type="button" onClick={() => setLockModalOpen(false)} className="min-h-11 rounded-xl border border-black/5 bg-surface px-4 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-hover">
                Cancelar
              </button>
              <button type="button" onClick={confirmLock} className={`min-h-11 rounded-xl px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all hover:-translate-y-0.5 ${hasUnsyncedChanges ? 'bg-red-600 hover:bg-red-700' : 'bg-text-primary'}`}>
                Sí, bloquear
              </button>
            </div>
          </div>
        </div>
      )}
      <MasterPasswordPromptModal />

      </div>
    </div>
  )
}

interface GlobalSearchResult {
  id: string
  title: string
  subtitle: string
  action: () => void
}

function fuzzyMatch(value: string, query: string): boolean {
  const text = value.toLowerCase()
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  if (text.includes(needle)) return true

  let index = 0
  for (const char of text) {
    if (char === needle[index]) index += 1
    if (index === needle.length) return true
  }
  return false
}

function GlobalSearch({
  query,
  onQueryChange,
  results,
  syncing,
  className = '',
}: {
  query: string
  onQueryChange: (value: string) => void
  results: GlobalSearchResult[]
  syncing: boolean
  className?: string
}) {
  const visible = query.trim().length > 0

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          id="global-search-input"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar en toda la bóveda... (Pulsa /)"
          className="h-12 w-full rounded-2xl border border-black/[0.06] bg-white/90 pl-11 pr-12 text-[15px] font-medium text-text-primary shadow-subtle outline-none backdrop-blur-xl transition-all placeholder:text-text-tertiary focus:border-black/15 focus:bg-white focus:ring-4 focus:ring-black/[0.035] dark:border-white/10 dark:bg-slate-800/90 dark:text-white dark:focus:bg-slate-800"
          aria-label="Búsqueda global de la bóveda"
        />
      </div>

      {visible && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[48vh] overflow-y-auto rounded-3xl border border-black/[0.06] bg-white/95 p-2 shadow-[0_28px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl animate-vault-morph dark:border-white/10 dark:bg-slate-800/95">
          {syncing ? (
            <div className="flex flex-col gap-1 p-1">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 py-2 animate-pulse">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-black/5" />
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="h-3.5 w-32 rounded-full bg-black/5" />
                    <div className="h-2.5 w-48 rounded-full bg-black/[0.03]" />
                  </div>
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm font-medium text-text-tertiary">Sin resultados</div>
          ) : (
            results.slice(0, 50).map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => {
                  result.action()
                  onQueryChange('')
                }}
                className="flex min-h-14 w-full flex-col justify-center rounded-2xl px-4 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="text-[15px] font-semibold text-text-primary">{result.title}</span>
                <span className="mt-0.5 text-xs text-text-tertiary">{result.subtitle}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}



export default function App() {
  return (
    <ErrorBoundary>
      <VaultProvider>
        <VaultApp />
      </VaultProvider>
    </ErrorBoundary>
  )
}

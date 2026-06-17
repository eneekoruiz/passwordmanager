import { useEffect, useMemo, useState } from 'react'
import { VaultProvider, useVault } from './context/VaultContext'
import { SyncDiffViewer } from './components/SyncDiffViewer'
import { Sidebar } from './components/Sidebar'
import { MainArea } from './components/MainArea'
import { UnlockScreen } from './components/UnlockScreen'
import { SettingsModal } from './components/SettingsModal'
import { ImportTextModal } from './components/ImportTextModal'
import { IOSInstallPrompt } from './components/IOSInstallPrompt'
import { getFriendlyErrorMessage, logUnexpectedError } from './utils/errors'
import { LOCAL_ITEM_LABELS, vaultItemDisplayName } from './utils/vaultItem'
import type { LocalCategory, VaultGroupMode } from './types'
import type { CloudSyncResult } from './context/VaultContext'
import type { UnsavedFormActions } from './components/AccountForm'
import { useToast } from './components/ui/ToastProvider'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
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
    cloudSyncStatus,
    syncActiveProfileToCloud,
    downloadLatestCloudVault,
    logoutProfile,
    hasUnsyncedChanges,
  } = useVault()

  const { showToast } = useToast()

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
  const [groupMode, setGroupMode] = useState<VaultGroupMode>('identity')
  const [selectedPlatformName, setSelectedPlatformName] = useState<string | null>(null)
  const [selectedLocalCategory, setSelectedLocalCategory] = useState<LocalCategory | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)
  const [importTextOpen, setImportTextOpen] = useState(false)
  const [travelModeEnabled, setTravelModeEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.sessionStorage.getItem('contras.travelMode') === '1'
  })
  const [mobileSyncCheckVisible, setMobileSyncCheckVisible] = useState(false)
  const [unsavedDirty, setUnsavedDirty] = useState(false)
  const [unsavedActions, setUnsavedActions] = useState<UnsavedFormActions | null>(null)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false)
  const [lockModalOpen, setLockModalOpen] = useState(false)
  const [savingBeforeNavigation, setSavingBeforeNavigation] = useState(false)
  const [pendingCloudDownload, setPendingCloudDownload] = useState<CloudSyncResult | null>(null)
  const [downloadingCloud, setDownloadingCloud] = useState(false)

  const displayIdentities = useMemo(
    () =>
      travelModeEnabled
        ? identities
            .map((identity) => ({
              ...identity,
              platforms: identity.platforms.filter((platform) => !platform.sensitive),
            }))
            .filter((identity) => identity.platforms.length > 0)
        : identities,
    [identities, travelModeEnabled],
  )

  const selectedIdentity = useMemo(
    () => displayIdentities.find((identity) => identity.id === selectedId) ?? null,
    [displayIdentities, selectedId],
  )

  useEffect(() => {
    if (cloudSyncStatus !== 'synced') return
    setMobileSyncCheckVisible(true)
    const timer = window.setTimeout(() => setMobileSyncCheckVisible(false), 1600)
    return () => window.clearTimeout(timer)
  }, [cloudSyncStatus])

  useEffect(() => {
    if (!isUnlocked) return
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const
    let timer: number | null = null

    const resetTimer = () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        logoutProfile()
        setSelectedId(null)
        setSelectedPlatformName(null)
        setSelectedLocalCategory(null)
        setSearchQuery('')
        showToast('Sesión bloqueada automáticamente por inactividad.', 'info')
      }, 5 * 60 * 1000)
    }

    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }))
    resetTimer()

    return () => {
      if (timer !== null) window.clearTimeout(timer)
      events.forEach((event) => window.removeEventListener(event, resetTimer))
    }
  }, [isUnlocked, logoutProfile])

  useEffect(() => {
    if (!unsavedDirty && !hasUnsyncedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [unsavedDirty, hasUnsyncedChanges])

  if (!isReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <p className="text-sm text-text-secondary">Cargando…</p>
      </div>
    )
  }

  if (!isUnlocked) {
    return <UnlockScreen />
  }

  const reportUiError = (error: unknown, fallback: string) => {
    const message = getFriendlyErrorMessage(error, fallback)
    showToast(message, 'error')
  }

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

  const handleSelect = (id: string) => {
    requestNavigation(() => {
      setSelectedId(id)
      setSelectedPlatformName(null)
      setSelectedLocalCategory(null)
      setSidebarOpen(false)
    })
  }

  const handleSelectPlatform = (platformName: string) => {
    requestNavigation(() => {
      setSelectedPlatformName(platformName)
      setSelectedId(null)
      setSelectedLocalCategory(null)
      setSidebarOpen(false)
    })
  }

  const handleGroupModeChange = (mode: VaultGroupMode) => {
    requestNavigation(() => {
      setGroupMode(mode)
      setSearchQuery('')
      setSelectedId(null)
      setSelectedPlatformName(null)
      setSelectedLocalCategory(null)
    })
  }

  const handleSelectLocalCategory = (category: LocalCategory) => {
    requestNavigation(() => {
      setSelectedLocalCategory(category)
      setSelectedId(null)
      setSelectedPlatformName(null)
      setSidebarOpen(false)
    })
  }

  const handleManualSync = async () => {
    try {
      const result = await syncActiveProfileToCloud()
      if (result.action === 'download_available') {
        setPendingCloudDownload(result)
        return
      }
      showToast(result.message, 'info')
    } catch (error) {
      reportUiError(error, 'No se pudo sincronizar la bóveda.')
    }
  }

  const handleConfirmCloudDownload = async () => {
    setDownloadingCloud(true)
    try {
      const result = await downloadLatestCloudVault()
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
    setSearchQuery('')
    showToast('Modo Viaje activado. Las cuentas sensibles quedan ocultas hasta verificar la Contraseña Maestra.', 'info')
  }

  const disableTravelMode = async (masterPassword: string) => {
    const verified = await verifyCurrentMasterPassword(masterPassword)
    if (!verified) throw new Error('Contraseña Maestra incorrecta.')
    setTravelModeEnabled(false)
    window.sessionStorage.removeItem('contras.travelMode')
    showToast('Modo Viaje desactivado. La bóveda completa vuelve a estar visible.', 'success')
  }

  const globalSearchResults = (() => {
    const query = searchQuery.trim()
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
        const haystack = [platform.name, platform.username, identity.email, platform.notes].filter(Boolean).join(' ')
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

    for (const item of localItems) {
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

    return results
  })()

  const handleLock = () => {
    requestNavigation(() => setLockModalOpen(true))
  }

  const confirmLock = () => {
    setLockModalOpen(false)
    logoutProfile()
    setSelectedId(null)
    setSelectedPlatformName(null)
    setSelectedLocalCategory(null)
    setSearchQuery('')
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

  const mobileTopBar = isMobile ? (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-black/5 bg-white/85 px-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-text-primary">Contras</p>
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
          {currentProfileName ?? 'Bóveda segura'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setSettingsMenuOpen((open) => !open)}
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/5 bg-white text-text-secondary shadow-sm transition-all active:scale-[0.96] disabled:opacity-70"
        aria-label="Abrir ajustes"
      >
        {mobileSyncCheckVisible ? (
          <svg className="h-5 w-5 text-emerald-600 animate-vault-morph" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : cloudSyncStatus === 'error' ? (
          <span className="relative flex h-5 w-5 items-center justify-center">
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-600" />
          </span>
        ) : (
          <svg className={`h-5 w-5 ${cloudSyncStatus === 'syncing' ? 'animate-spin text-blue-600' : 'text-text-secondary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </button>
    </header>
  ) : null

  const globalOverlays = (
    <>
      {!settingsOpen && !importTextOpen && !lockModalOpen && (
        <GlobalSearch
          query={searchQuery}
          onQueryChange={setSearchQuery}
          results={globalSearchResults}
          syncing={cloudSyncStatus === 'syncing'}
          hasSettingsButton={!isMobile}
        />
      )}

      <div className="fixed right-4 top-16 z-[80] lg:top-4">
        {!isMobile && (
          <button
            type="button"
            onClick={() => setSettingsMenuOpen((open) => !open)}
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/[0.06] bg-white/90 text-text-primary shadow-[0_18px_55px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all hover:-translate-y-0.5"
            aria-label="Abrir ajustes"
          >
            <svg className={`h-5 w-5 ${cloudSyncStatus === 'syncing' ? 'animate-spin text-blue-600' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}

        {settingsMenuOpen && (
          <div className="absolute right-0 mt-2 w-72 rounded-3xl border border-black/[0.06] bg-white/95 p-2 shadow-[0_28px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl">
            <div className="px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-tertiary">Ajustes</p>
              <p className="mt-1 truncate text-xs font-semibold text-text-primary">{currentProfileName ?? 'Bóveda segura'}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSettingsMenuOpen(false)
                void handleManualSync()
              }}
              disabled={cloudSyncStatus === 'syncing'}
              className="flex min-h-12 w-full items-center justify-between rounded-2xl px-3 text-left text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-60"
            >
              <span>{cloudSyncStatus === 'syncing' ? 'Sincronizando...' : 'Sincronizar ahora'}</span>
              <span className={`h-2.5 w-2.5 rounded-full ${cloudSyncStatus === 'error' ? 'bg-red-500' : cloudSyncStatus === 'synced' ? 'bg-emerald-500' : 'bg-text-tertiary'}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                setSettingsMenuOpen(false)
                setSettingsOpen(true)
              }}
              className="flex min-h-12 w-full items-center rounded-2xl px-3 text-left text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
            >
              Exportación, importación y nube
            </button>
            <button
              type="button"
              onClick={() => {
                setSettingsMenuOpen(false)
                handleLock()
              }}
              className="flex min-h-12 w-full items-center rounded-2xl px-3 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
            >
              Bloquear bóveda
            </button>
          </div>
        )}
      </div>
    </>
  )

  const cloudDownloadModal = pendingCloudDownload ? (
    pendingCloudDownload.diffResult ? (
      <SyncDiffViewer
        diffResult={pendingCloudDownload.diffResult}
        onConfirm={handleConfirmCloudDownload}
        onCancel={() => setPendingCloudDownload(null)}
        isDownloading={downloadingCloud}
      />
    ) : (
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-fade-in">
        <div className="w-full max-w-lg rounded-3xl border border-white/50 bg-white/95 p-6 shadow-[0_34px_100px_rgba(15,23,42,0.25)] backdrop-blur-xl animate-vault-morph">
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
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setPendingCloudDownload(null)}
              disabled={downloadingCloud}
              className="min-h-11 rounded-xl border border-black/5 bg-surface px-4 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-60"
            >
              Ahora no
            </button>
            <button
              type="button"
              onClick={handleConfirmCloudDownload}
              disabled={downloadingCloud}
              className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-60"
            >
              {downloadingCloud ? 'Descargando...' : 'Descargar de la nube'}
            </button>
          </div>
        </div>
      </div>
    )
  ) : null

  if (isMobile) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-surface pb-16">
        {mobileTopBar}
        {globalOverlays}
        <div className="flex-1 overflow-y-auto pt-28">
          {selectedId === null && selectedLocalCategory === null && selectedPlatformName === null ? (
            <Sidebar
              identities={displayIdentities}
              localItems={localItems}
              groupMode={groupMode}
              selectedId={selectedId}
              selectedPlatformName={selectedPlatformName}
              selectedLocalCategory={selectedLocalCategory}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
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
            />
          ) : (
            <MainArea
              identities={displayIdentities}
              identity={selectedIdentity}
              groupMode={groupMode}
              selectedPlatformName={selectedPlatformName}
              localCategory={selectedLocalCategory}
              localItems={localItems}
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
              onAddPlatform={addPlatform}
              onUpdatePlatform={updatePlatform}
              onDeletePlatform={deletePlatform}
              onSaveLocalItem={saveLocalItem}
              onDeleteLocalItem={deleteLocalItem}
              isMobile={true}
            />
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-black/5 bg-white/70 px-6 pb-safe shadow-[0_-1px_10px_rgba(0,0,0,0.02)] backdrop-blur-lg">
          <button
            type="button"
            onClick={() => {
              requestNavigation(() => {
                setSelectedId(null)
                setSelectedPlatformName(null)
                setSelectedLocalCategory(null)
              })
            }}
            className={`flex w-16 flex-col items-center justify-center gap-0.5 text-center transition-colors ${
              selectedId === null && selectedLocalCategory === null && selectedPlatformName === null ? 'text-text-primary' : 'text-text-tertiary'
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-[10px] font-semibold">Plataformas</span>
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex w-16 flex-col items-center justify-center gap-0.5 text-center text-text-tertiary transition-colors hover:text-text-primary"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[10px] font-semibold">Ajustes</span>
          </button>

          <button
            type="button"
            onClick={handleLock}
            className="flex w-16 flex-col items-center justify-center gap-0.5 text-center text-text-tertiary transition-colors hover:text-text-primary"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span className="text-[10px] font-semibold">Cerrar</span>
          </button>
        </div>

        <SettingsModal
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
        {cloudDownloadModal}

        {unsavedModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-md rounded-3xl border border-white/50 bg-white/95 p-6 shadow-[0_34px_100px_rgba(15,23,42,0.25)] backdrop-blur-xl animate-vault-morph">
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
            <div className="w-full max-w-lg rounded-3xl border border-white/50 bg-white/95 p-6 shadow-[0_34px_100px_rgba(15,23,42,0.25)] backdrop-blur-xl animate-vault-morph">
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
                  <button type="button" onClick={() => { setLockModalOpen(false); setSettingsOpen(true) }} className="min-h-12 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-800">
                    Descargar copia local (Cifrada/CSV) para no perder datos
                  </button>
                ) : (
                  <button type="button" onClick={() => { setLockModalOpen(false); setSettingsOpen(true) }} className="min-h-12 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800">
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
    <div className="flex min-h-dvh bg-surface">
      {globalOverlays}
      <Sidebar
        identities={displayIdentities}
        localItems={localItems}
        groupMode={groupMode}
        selectedId={selectedId}
        selectedPlatformName={selectedPlatformName}
        selectedLocalCategory={selectedLocalCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
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
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-elevated pt-20 lg:rounded-l-2xl lg:border-l lg:border-border-subtle">
          <MainArea
            identities={displayIdentities}
            identity={selectedIdentity}
            groupMode={groupMode}
            selectedPlatformName={selectedPlatformName}
            localCategory={selectedLocalCategory}
            localItems={localItems}
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
            onAddPlatform={addPlatform}
            onUpdatePlatform={updatePlatform}
            onDeletePlatform={deletePlatform}
            onSaveLocalItem={saveLocalItem}
            onDeleteLocalItem={deleteLocalItem}
            isMobile={false}
          />
        </main>
      </div>

      <SettingsModal
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
      {cloudDownloadModal}

      {unsavedModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-white/50 bg-white/95 p-6 shadow-[0_34px_100px_rgba(15,23,42,0.25)] backdrop-blur-xl animate-vault-morph">
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
          <div className="w-full max-w-lg rounded-3xl border border-white/50 bg-white/95 p-6 shadow-[0_34px_100px_rgba(15,23,42,0.25)] backdrop-blur-xl animate-vault-morph">
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
  hasSettingsButton,
}: {
  query: string
  onQueryChange: (value: string) => void
  results: GlobalSearchResult[]
  syncing: boolean
  hasSettingsButton: boolean
}) {
  const visible = query.trim().length > 0

  return (
    <div className={`fixed left-4 top-16 z-[70] mx-auto max-w-2xl lg:left-[calc(20rem+2rem)] lg:top-4 ${hasSettingsButton ? 'right-20 lg:right-28' : 'right-4'}`}>
      <div className="relative">
        <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar en toda la bóveda..."
          className="h-12 w-full rounded-2xl border border-black/[0.06] bg-white/90 pl-11 pr-12 text-[15px] font-medium text-text-primary shadow-[0_18px_55px_rgba(15,23,42,0.12)] outline-none backdrop-blur-xl transition-all placeholder:text-text-tertiary focus:border-black/15 focus:bg-white focus:ring-4 focus:ring-black/[0.035]"
          aria-label="Búsqueda global de la bóveda"
        />
        {syncing && (
          <span className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        )}
      </div>

      {visible && (
        <div className="mt-2 max-h-[48vh] overflow-y-auto rounded-3xl border border-black/[0.06] bg-white/95 p-2 shadow-[0_28px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm font-medium text-text-tertiary">Sin resultados</div>
          ) : (
            results.slice(0, 8).map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => {
                  result.action()
                  onQueryChange('')
                }}
                className="flex min-h-14 w-full flex-col justify-center rounded-2xl px-4 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="truncate text-sm font-semibold text-text-primary">{result.title}</span>
                <span className="truncate text-xs text-text-tertiary">{result.subtitle}</span>
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
    <VaultProvider>
      <VaultApp />
    </VaultProvider>
  )
}

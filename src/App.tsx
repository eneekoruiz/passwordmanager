import { useEffect, useMemo, useState } from 'react'
import { VaultProvider, useVault } from './context/VaultContext'
import { Sidebar } from './components/Sidebar'
import { MainArea } from './components/MainArea'
import { UnlockScreen } from './components/UnlockScreen'
import { SettingsModal } from './components/SettingsModal'
import { ImportTextModal } from './components/ImportTextModal'
import { IOSInstallPrompt } from './components/IOSInstallPrompt'
import { getFriendlyErrorMessage, logUnexpectedError } from './utils/errors'
import type { LocalVaultItemType, VaultGroupMode } from './types'

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
    importBackup,
    importMassiveAccounts,
    currentProfileName,
    cloudSyncStatus,
    syncActiveProfileToCloud,
    logoutProfile,
    appError,
    clearAppError,
  } = useVault()

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
  const [selectedLocalCategory, setSelectedLocalCategory] = useState<LocalVaultItemType | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importTextOpen, setImportTextOpen] = useState(false)
  const [mobileSyncCheckVisible, setMobileSyncCheckVisible] = useState(false)

  const selectedIdentity = useMemo(
    () => identities.find((identity) => identity.id === selectedId) ?? null,
    [identities, selectedId],
  )

  const [pageMessage, setPageMessage] = useState<string | null>(null)

  useEffect(() => {
    setPageMessage(appError)
  }, [appError])

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
        setPageMessage('Sesión bloqueada automáticamente por inactividad.')
      }, 5 * 60 * 1000)
    }

    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }))
    resetTimer()

    return () => {
      if (timer !== null) window.clearTimeout(timer)
      events.forEach((event) => window.removeEventListener(event, resetTimer))
    }
  }, [isUnlocked, logoutProfile])

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

  const dismissMessage = () => {
    setPageMessage(null)
    clearAppError()
  }

  const reportUiError = (error: unknown, fallback: string) => {
    const message = getFriendlyErrorMessage(error, fallback)
    setPageMessage(message)
  }

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setSelectedPlatformName(null)
    setSelectedLocalCategory(null)
    setSidebarOpen(false)
  }

  const handleSelectPlatform = (platformName: string) => {
    setSelectedPlatformName(platformName)
    setSelectedId(null)
    setSelectedLocalCategory(null)
    setSidebarOpen(false)
  }

  const handleGroupModeChange = (mode: VaultGroupMode) => {
    setGroupMode(mode)
    setSearchQuery('')
    setSelectedId(null)
    setSelectedPlatformName(null)
    setSelectedLocalCategory(null)
  }

  const handleSelectLocalCategory = (type: LocalVaultItemType) => {
    setSelectedLocalCategory(type)
    setSelectedId(null)
    setSelectedPlatformName(null)
    setSidebarOpen(false)
  }

  const handleLock = () => {
    logoutProfile()
    setSelectedId(null)
    setSelectedPlatformName(null)
    setSelectedLocalCategory(null)
    setSearchQuery('')
    setPageMessage(null)
  }

  const handleDeleteIdentity = async (id: string) => {
    try {
      await deleteIdentity(id)
      if (selectedId === id) {
        setSelectedId(null)
      }
      dismissMessage()
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

  const pageBanner = pageMessage ? (
    <div className="border-b border-red-100 bg-red-50/85 px-4 py-3 text-xs text-red-700 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-start justify-between gap-3">
        <span className="leading-relaxed">{pageMessage}</span>
        <button
          type="button"
          onClick={dismissMessage}
          className="shrink-0 rounded-md px-2 py-1 font-semibold text-red-700 transition-colors hover:bg-red-100"
        >
          Cerrar
        </button>
      </div>
    </div>
  ) : null

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
        onClick={() => {
          void syncActiveProfileToCloud().catch((error) => {
            reportUiError(error, 'No se pudo sincronizar la bóveda.')
          })
        }}
        disabled={cloudSyncStatus === 'syncing'}
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/5 bg-white text-text-secondary shadow-sm transition-all active:scale-[0.96] disabled:opacity-70"
        aria-label="Sincronizar bóveda"
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-2.25 2.25M12 9.75l2.25 2.25M6.75 18.75h10.5a3.75 3.75 0 00.98-7.37A6.001 6.001 0 006.36 9.18a4.5 4.5 0 00.39 9.57z" />
          </svg>
        )}
      </button>
    </header>
  ) : null

  if (isMobile) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-surface pb-16">
        {mobileTopBar}
        {pageBanner}
        <div className="flex-1 overflow-y-auto pt-14">
          {selectedId === null && selectedLocalCategory === null && selectedPlatformName === null ? (
            <Sidebar
              identities={identities}
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
                setSelectedId(identity.id)
                setSelectedPlatformName(null)
                setSelectedLocalCategory(null)
              }}
              onDeleteIdentity={handleDeleteIdentity}
              onLock={handleLock}
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
              identities={identities}
              identity={selectedIdentity}
              groupMode={groupMode}
              selectedPlatformName={selectedPlatformName}
              localCategory={selectedLocalCategory}
              localItems={localItems}
              onOpenSidebar={() => {}}
              onSelectIdentity={(id) => {
                setSelectedId(id)
                setSelectedPlatformName(null)
                setSelectedLocalCategory(null)
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
              setSelectedId(null)
              setSelectedPlatformName(null)
              setSelectedLocalCategory(null)
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
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh bg-surface">
      <Sidebar
        identities={identities}
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
          setSelectedId(identity.id)
          setSelectedPlatformName(null)
          setSelectedLocalCategory(null)
        }}
        onDeleteIdentity={handleDeleteIdentity}
        onLock={handleLock}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
        profileName={currentProfileName}
        isMobile={false}
        installPromptAvailable={Boolean(deferredPrompt)}
        onInstall={handleInstallApp}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {pageBanner}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-elevated lg:rounded-l-2xl lg:border-l lg:border-border-subtle">
          <MainArea
            identities={identities}
            identity={selectedIdentity}
            groupMode={groupMode}
            selectedPlatformName={selectedPlatformName}
            localCategory={selectedLocalCategory}
            localItems={localItems}
            onOpenSidebar={() => setSidebarOpen(true)}
            onSelectIdentity={(id) => {
              setSelectedId(id)
              setSelectedPlatformName(null)
              setSelectedLocalCategory(null)
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

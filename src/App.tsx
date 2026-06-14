import { useEffect, useMemo, useState } from 'react'
import { VaultProvider, useVault } from './context/VaultContext'
import { Sidebar } from './components/Sidebar'
import { MainArea } from './components/MainArea'
import { UnlockScreen } from './components/UnlockScreen'
import { SettingsModal } from './components/SettingsModal'
import { ImportTextModal } from './components/ImportTextModal'
import { IOSInstallPrompt } from './components/IOSInstallPrompt'
import { getFriendlyErrorMessage, logUnexpectedError } from './utils/errors'
import type { LocalVaultItemType } from './types'

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
    importBackup,
    importMassiveAccounts,
    currentProfileName,
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
  const [selectedLocalCategory, setSelectedLocalCategory] = useState<LocalVaultItemType | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importTextOpen, setImportTextOpen] = useState(false)

  const filteredIdentities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return identities
    return identities.filter((identity) => identity.email.toLowerCase().includes(query))
  }, [identities, searchQuery])

  const selectedIdentity = useMemo(
    () => identities.find((identity) => identity.id === selectedId) ?? null,
    [identities, selectedId],
  )

  const [pageMessage, setPageMessage] = useState<string | null>(null)

  useEffect(() => {
    setPageMessage(appError)
  }, [appError])

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
    setSelectedLocalCategory(null)
    setSidebarOpen(false)
  }

  const handleSelectLocalCategory = (type: LocalVaultItemType) => {
    setSelectedLocalCategory(type)
    setSelectedId(null)
    setSidebarOpen(false)
  }

  const handleLock = () => {
    logoutProfile()
    setSelectedId(null)
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

  if (isMobile) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-surface pb-16">
        {pageBanner}
        <div className="flex-1 overflow-y-auto">
          {selectedId === null && selectedLocalCategory === null ? (
            <Sidebar
              identities={filteredIdentities}
              localItems={localItems}
              selectedId={selectedId}
              selectedLocalCategory={selectedLocalCategory}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelect={handleSelect}
              onSelectLocalCategory={handleSelectLocalCategory}
              onAddIdentity={async (email) => {
                const identity = await addIdentity(email)
                setSelectedId(identity.id)
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
              identity={selectedIdentity}
              localCategory={selectedLocalCategory}
              localItems={localItems}
              onOpenSidebar={() => {}}
              onSelectIdentity={(id) => {
                setSelectedId(id)
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
              setSelectedLocalCategory(null)
            }}
            className={`flex w-16 flex-col items-center justify-center gap-0.5 text-center transition-colors ${
              selectedId === null && selectedLocalCategory === null ? 'text-text-primary' : 'text-text-tertiary'
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
              setSelectedLocalCategory(null)
            }
          }}
        />

        <IOSInstallPrompt />
      </div>
    )
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-surface">
      <Sidebar
        identities={filteredIdentities}
        localItems={localItems}
        selectedId={selectedId}
        selectedLocalCategory={selectedLocalCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelect={handleSelect}
        onSelectLocalCategory={handleSelectLocalCategory}
        onAddIdentity={async (email) => {
          const identity = await addIdentity(email)
          setSelectedId(identity.id)
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

      <div className="flex min-w-0 flex-1 flex-col">
        {pageBanner}
        <main className="flex min-w-0 flex-1 flex-col bg-surface-elevated lg:rounded-l-2xl lg:border-l lg:border-border-subtle">
          <MainArea
            identity={selectedIdentity}
            localCategory={selectedLocalCategory}
            localItems={localItems}
            onOpenSidebar={() => setSidebarOpen(true)}
            onSelectIdentity={(id) => {
              setSelectedId(id)
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

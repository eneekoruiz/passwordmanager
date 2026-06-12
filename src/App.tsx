import { useMemo, useState, useEffect } from 'react'
import { VaultProvider, useVault } from './context/VaultContext'
import { Sidebar } from './components/Sidebar'
import { MainArea } from './components/MainArea'
import { UnlockScreen } from './components/UnlockScreen'
import { SettingsModal } from './components/SettingsModal'
import { ImportTextModal } from './components/ImportTextModal'

function VaultApp() {
  const {
    isReady,
    isUnlocked,
    platforms,
    addPlatform,
    savePlatform,
    deletePlatform,
    exportBackup,
    importBackup,
    importMassiveAccounts,
    currentProfileName,
    logoutProfile,
  } = useVault()

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importTextOpen, setImportTextOpen] = useState(false)

  const filteredPlatforms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return platforms
    return platforms.filter((p) => p.name.toLowerCase().includes(query))
  }, [platforms, searchQuery])

  const selectedPlatform = useMemo(
    () => platforms.find((p) => p.id === selectedId) ?? null,
    [platforms, selectedId],
  )

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

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setSidebarOpen(false)
  }

  const handleLock = () => {
    logoutProfile()
    setSelectedId(null)
    setSearchQuery('')
  }

  const handleRenamePlatform = async (id: string, name: string) => {
    const platform = platforms.find((p) => p.id === id)
    if (platform) {
      await savePlatform({ ...platform, name })
    }
  }

  const handleDeletePlatform = async (id: string) => {
    await deletePlatform(id)
    if (selectedId === id) {
      setSelectedId(null)
    }
  }

  const handleExportBackup = async (password: string) => {
    const backupJsonString = await exportBackup(password)
    const blob = new Blob([backupJsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contras_backup_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImportBackup = async (backupJsonString: string, password: string) => {
    await importBackup(backupJsonString, password)
    setSelectedId(null)
  }

  if (isMobile) {
    return (
      <div className="flex h-dvh flex-col bg-surface overflow-hidden pb-16">
        <div className="flex-1 overflow-y-auto">
          {selectedId === null ? (
            <Sidebar
              platforms={filteredPlatforms}
              selectedId={selectedId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelect={handleSelect}
              onAddPlatform={async (name) => {
                const platform = await addPlatform(name)
                setSelectedId(platform.id)
              }}
              onRenamePlatform={handleRenamePlatform}
              onDeletePlatform={handleDeletePlatform}
              onLock={handleLock}
              isOpen={false}
              onClose={() => {}}
              onOpenSettings={() => setSettingsOpen(true)}
              profileName={currentProfileName}
              isMobile={true}
            />
          ) : (
            <MainArea
              platform={selectedPlatform}
              onOpenSidebar={() => {}}
              onSelectPlatform={setSelectedId}
              onOpenImportText={() => setImportTextOpen(true)}
              isMobile={true}
            />
          )}
        </div>

        {/* Bottom Navigation Bar translúcida estilo iOS */}
        <div className="fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-black/5 bg-white/70 backdrop-blur-lg flex items-center justify-around px-6 pb-safe shadow-[0_-1px_10px_rgba(0,0,0,0.02)]">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className={`flex flex-col items-center justify-center gap-0.5 w-16 text-center transition-colors ${
              selectedId === null ? 'text-text-primary' : 'text-text-tertiary'
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
            className="flex flex-col items-center justify-center gap-0.5 w-16 text-center text-text-tertiary hover:text-text-primary transition-colors"
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
            className="flex flex-col items-center justify-center gap-0.5 w-16 text-center text-text-tertiary hover:text-text-primary transition-colors"
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
          onImport={importMassiveAccounts}
        />
      </div>
    )
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-surface">
      <Sidebar
        platforms={filteredPlatforms}
        selectedId={selectedId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelect={handleSelect}
        onAddPlatform={async (name) => {
          const platform = await addPlatform(name)
          setSelectedId(platform.id)
        }}
        onRenamePlatform={handleRenamePlatform}
        onDeletePlatform={handleDeletePlatform}
        onLock={handleLock}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
        profileName={currentProfileName}
        isMobile={false}
      />

      <main className="flex flex-1 flex-col min-w-0 bg-surface-elevated lg:rounded-l-2xl lg:border-l lg:border-border-subtle">
        <MainArea
          platform={selectedPlatform}
          onOpenSidebar={() => setSidebarOpen(true)}
          onSelectPlatform={setSelectedId}
          onOpenImportText={() => setImportTextOpen(true)}
          isMobile={false}
        />
      </main>

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
        onImport={importMassiveAccounts}
      />
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

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CryptoVault } from '../crypto/CryptoVault'
import { VaultStore } from '../storage/VaultStore'
import type { Account, Platform } from '../types'
import { generateId } from '../utils/id'
import { supabase } from '../services/supabase'

/**
 * @interface VaultContextValue
 * @description Estructura expuesta por el contexto global de la bóveda para la interfaz de usuario.
 */
interface VaultContextValue {
  isReady: boolean
  isInitialized: boolean
  isUnlocked: boolean
  platforms: Platform[]
  /** Listado de perfiles locales disponibles en el dispositivo */
  profiles: { id: string; name: string; createdAt: string }[]
  /** ID del perfil activo de la sesión actual */
  currentProfileId: string | null
  /** Nombre visible del perfil activo */
  currentProfileName: string | null
  /** Carga y refresca los perfiles del almacén meta de IndexedDB */
  listProfiles: () => Promise<void>
  /** Crea un perfil local con contraseña maestra independiente */
  createProfile: (name: string, password: string) => Promise<string>
  /** Desbloquea la clave criptográfica de sesión del perfil seleccionado */
  selectProfile: (id: string, password: string) => Promise<boolean>
  /** Elimina el perfil activo y todos sus registros asociados de IndexedDB */
  deleteCurrentProfile: () => Promise<void>
  /** Cierra la sesión activa regresando al selector de perfiles */
  logoutProfile: () => void
  addPlatform: (name: string) => Promise<Platform>
  savePlatform: (platform: Platform) => Promise<void>
  deletePlatform: (platformId: string) => Promise<void>
  addAccount: (platformId: string, account: Account) => Promise<void>
  updateAccount: (
    platformId: string,
    accountId: string,
    account: Account,
  ) => Promise<void>
  deleteAccount: (platformId: string, accountId: string) => Promise<void>
  exportBackup: (masterPassword: string) => Promise<string>
  importBackup: (backupJsonString: string, masterPassword: string) => Promise<void>
  importMassiveAccounts: (
    parsedAccounts: Array<{ platformName: string; account: Account }>,
  ) => Promise<void>
  // Estados y métodos de Sincronización en la Nube E2EE (BaaS)
  cloudUserEmail: string | null
  cloudSyncStatus: 'idle' | 'syncing' | 'synced' | 'error'
  cloudError: string | null
  loginCloud: (email: string, password: string) => Promise<void>
  registerCloud: (email: string, password: string) => Promise<void>
  logoutCloud: () => Promise<void>
  syncActiveProfileToCloud: () => Promise<void>
  restoreProfileFromCloud: (email: string, password: string, masterPassword: string) => Promise<void>
}

const VaultContext = createContext<VaultContextValue | null>(null)

export function VaultProvider({ children }: { children: ReactNode }) {
  const vaultRef = useRef(new CryptoVault())
  const storeRef = useRef(new VaultStore(vaultRef.current))

  const [isReady, setIsReady] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [platforms, setPlatforms] = useState<Platform[]>([])
  
  // Estados para la gestión de perfiles múltiples
  const [profiles, setProfiles] = useState<{ id: string; name: string; createdAt: string }[]>([])
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null)
  const [currentProfileName, setCurrentProfileName] = useState<string | null>(null)

  const listProfiles = useCallback(async () => {
    const list = await storeRef.current.listProfiles()
    setProfiles(list)
    setIsInitialized(list.length > 0)
  }, [])

  // Estados de Sincronización en la Nube (BaaS)
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null)
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const [cloudError, setCloudError] = useState<string | null>(null)

  // Escuchar estado de autenticación en Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCloudUserEmail(session.user.email || 'Usuario Nube')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCloudUserEmail(session.user.email || 'Usuario Nube')
      } else {
        setCloudUserEmail(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const loginCloud = useCallback(async (email: string, password: string) => {
    setCloudError(null)
    setCloudSyncStatus('syncing')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setCloudSyncStatus('error')
      setCloudError(error.message)
      throw error
    }
    if (data.user) {
      setCloudUserEmail(data.user.email || 'Usuario Nube')
      setCloudSyncStatus('idle')
    }
  }, [])

  const registerCloud = useCallback(async (email: string, password: string) => {
    setCloudError(null)
    setCloudSyncStatus('syncing')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setCloudSyncStatus('error')
      setCloudError(error.message)
      throw error
    }
    if (data.user) {
      setCloudUserEmail(data.user.email || 'Usuario Nube')
      setCloudSyncStatus('idle')
    }
  }, [])

  const logoutCloud = useCallback(async () => {
    setCloudError(null)
    const { error } = await supabase.auth.signOut()
    if (error) {
      setCloudError(error.message)
      throw error
    }
    setCloudUserEmail(null)
    setCloudSyncStatus('idle')
  }, [])

  const syncActiveProfileToCloud = useCallback(async () => {
    if (!currentProfileId) return
    const sessionRes = await supabase.auth.getSession()
    const session = sessionRes.data.session
    if (!session?.user) {
      setCloudSyncStatus('idle')
      return
    }

    setCloudSyncStatus('syncing')
    setCloudError(null)
    try {
      const encryptedBlob = await storeRef.current.exportCloudPayload(currentProfileId)
      const { error } = await supabase
        .from('vaults')
        .upsert({
          user_id: session.user.id,
          encrypted_vault_blob: encryptedBlob,
          updated_at: new Date().toISOString()
        })
      if (error) throw error
      setCloudSyncStatus('synced')
    } catch (err: any) {
      console.error('Error al sincronizar con la nube:', err)
      setCloudSyncStatus('error')
      setCloudError(err.message || 'Error al conectar con la nube.')
    }
  }, [currentProfileId])

  const triggerCloudSync = useCallback(() => {
    syncActiveProfileToCloud().catch(err => {
      console.warn('Fallo silencioso en background sync:', err)
    })
  }, [syncActiveProfileToCloud])

  const restoreProfileFromCloud = useCallback(async (email: string, password: string, masterPassword: string) => {
    setCloudError(null)
    setCloudSyncStatus('syncing')
    
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setCloudSyncStatus('error')
      setCloudError(authError.message)
      throw authError
    }

    if (!data.user) {
      setCloudSyncStatus('error')
      throw new Error('No se pudo autenticar en la nube.')
    }

    setCloudUserEmail(data.user.email || 'Usuario Nube')

    try {
      const { data: dbData, error: dbError } = await supabase
        .from('vaults')
        .select('encrypted_vault_blob')
        .eq('user_id', data.user.id)
        .single()

      if (dbError) {
        if (dbError.code === 'PGRST116') {
          throw new Error('No se encontraron datos de la bóveda en esta cuenta de la nube.')
        }
        throw dbError
      }

      const blob = dbData?.encrypted_vault_blob
      if (!blob) {
        throw new Error('El archivo de la bóveda en la nube está vacío.')
      }

      const targetProfileId = 'default'
      await storeRef.current.restoreCloudPayload(targetProfileId, blob, masterPassword)
      const success = await storeRef.current.unlockProfile(targetProfileId, masterPassword)
      
      if (success) {
        setCurrentProfileId(targetProfileId)
        setCurrentProfileName('Bóveda Restaurada')
        setIsUnlocked(true)
        
        const loaded = await storeRef.current.loadAllPlatforms(targetProfileId)
        setPlatforms(loaded)
        setCloudSyncStatus('synced')
        await listProfiles()
      } else {
        throw new Error('Error al desbloquear el perfil restaurado.')
      }
    } catch (err: any) {
      console.error('Error al restaurar desde la nube:', err)
      setCloudSyncStatus('error')
      setCloudError(err.message || 'Error en la restauración.')
      throw err
    }
  }, [listProfiles])

  // Obtener y listar perfiles iniciales. Soporta migración automática si proviene de v0.1.
  useEffect(() => {
    storeRef.current.isInitialized().then(async (initialized) => {
      setIsInitialized(initialized)
      if (initialized) {
        const loaded = await storeRef.current.listProfiles()
        setProfiles(loaded)
        if (loaded.length === 0) {
          setIsInitialized(false)
        }
      }
      setIsReady(true)
    })
  }, [])



  const refreshPlatforms = useCallback(async () => {
    if (!currentProfileId) return
    const loaded = await storeRef.current.loadAllPlatforms(currentProfileId)
    setPlatforms(loaded)
  }, [currentProfileId])

  const createProfile = useCallback(async (name: string, password: string) => {
    const id = await storeRef.current.createProfile(name, password)
    await listProfiles()
    return id
  }, [listProfiles])

  const selectProfile = useCallback(async (id: string, password: string) => {
    const success = await storeRef.current.unlockProfile(id, password)
    if (success) {
      const list = await storeRef.current.listProfiles()
      const prof = list.find((p) => p.id === id)
      setCurrentProfileId(id)
      setCurrentProfileName(prof ? prof.name : 'Usuario')
      setIsUnlocked(true)
      
      const loaded = await storeRef.current.loadAllPlatforms(id)
      setPlatforms(loaded)
    }
    return success
  }, [])

  const logoutProfile = useCallback(() => {
    vaultRef.current.lock()
    setIsUnlocked(false)
    setCurrentProfileId(null)
    setCurrentProfileName(null)
    setPlatforms([])
  }, [])

  const deleteCurrentProfile = useCallback(async () => {
    if (!currentProfileId) return
    const idToDelete = currentProfileId
    logoutProfile()
    await storeRef.current.deleteProfile(idToDelete)
    await listProfiles()
  }, [currentProfileId, logoutProfile, listProfiles])

  const savePlatform = useCallback(async (platform: Platform) => {
    if (!currentProfileId) return
    const updated: Platform = {
      ...platform,
      updatedAt: new Date().toISOString(),
    }
    await storeRef.current.savePlatform(currentProfileId, updated)
    await refreshPlatforms()
    triggerCloudSync()
  }, [currentProfileId, refreshPlatforms, triggerCloudSync])

  const addPlatform = useCallback(async (name: string) => {
    if (!currentProfileId) throw new Error('Ningún perfil activo.')
    const now = new Date().toISOString()
    const platform: Platform = {
      id: generateId(),
      name: name.trim(),
      accounts: [],
      createdAt: now,
      updatedAt: now,
    }
    await storeRef.current.savePlatform(currentProfileId, platform)
    await refreshPlatforms()
    triggerCloudSync()
    return platform
  }, [currentProfileId, refreshPlatforms, triggerCloudSync])

  const deletePlatform = useCallback(async (platformId: string) => {
    if (!currentProfileId) return
    await storeRef.current.deletePlatform(currentProfileId, platformId)
    await refreshPlatforms()
    triggerCloudSync()
  }, [currentProfileId, refreshPlatforms, triggerCloudSync])

  const addAccount = useCallback(
    async (platformId: string, account: Account) => {
      const platform = platforms.find((p) => p.id === platformId)
      if (!platform) throw new Error('Plataforma no encontrada.')

      const now = new Date().toISOString()
      const newAccount: Account = { ...account, updatedAt: now }

      await savePlatform({
        ...platform,
        accounts: [...platform.accounts, newAccount],
      })
    },
    [platforms, savePlatform],
  )

  const updateAccount = useCallback(
    async (platformId: string, accountId: string, account: Account) => {
      const platform = platforms.find((p) => p.id === platformId)
      if (!platform) throw new Error('Plataforma no encontrada.')

      await savePlatform({
        ...platform,
        accounts: platform.accounts.map((a) =>
          a.id === accountId
            ? { ...account, updatedAt: new Date().toISOString() }
            : a,
        ),
      })
    },
    [platforms, savePlatform],
  )

  const deleteAccount = useCallback(
    async (platformId: string, accountId: string) => {
      const platform = platforms.find((p) => p.id === platformId)
      if (!platform) throw new Error('Plataforma no encontrada.')

      await savePlatform({
        ...platform,
        accounts: platform.accounts.filter((a) => a.id !== accountId),
      })
    },
    [platforms, savePlatform],
  )

  const exportBackup = useCallback(async (masterPassword: string) => {
    if (!currentProfileId) throw new Error('Ningún perfil activo.')
    return await storeRef.current.exportBackup(currentProfileId, masterPassword)
  }, [currentProfileId])

  const importBackup = useCallback(
    async (backupJsonString: string, masterPassword: string) => {
      if (!currentProfileId) throw new Error('Ningún perfil activo.')
      await storeRef.current.importBackup(currentProfileId, backupJsonString, masterPassword)
      await storeRef.current.unlockProfile(currentProfileId, masterPassword)
      await refreshPlatforms()
      triggerCloudSync()
    },
    [currentProfileId, refreshPlatforms, triggerCloudSync],
  )

  const importMassiveAccounts = useCallback(
    async (parsedAccounts: Array<{ platformName: string; account: Account }>) => {
      if (!currentProfileId) return
      let currentPlatforms = [...platforms]
      const platformsToSaveMap = new Map<string, Platform>()

      for (const item of parsedAccounts) {
        const platformNameTrimmed = item.platformName.trim()
        if (!platformNameTrimmed) continue

        const searchNameLower = platformNameTrimmed.toLowerCase()
        const platform =
          Array.from(platformsToSaveMap.values()).find(
            (p) => p.name.toLowerCase() === searchNameLower,
          ) ||
          currentPlatforms.find((p) => p.name.toLowerCase() === searchNameLower)

        const now = new Date().toISOString()
        const newAccount = { ...item.account, createdAt: now, updatedAt: now }

        if (!platform) {
          const newPlatform: Platform = {
            id: generateId(),
            name: platformNameTrimmed,
            accounts: [newAccount],
            createdAt: now,
            updatedAt: now,
          }
          platformsToSaveMap.set(newPlatform.id, newPlatform)
        } else {
          const updatedPlatform: Platform = {
            ...platform,
            accounts: [...platform.accounts, newAccount],
            updatedAt: now,
          }
          platformsToSaveMap.set(platform.id, updatedPlatform)
        }
      }

      if (platformsToSaveMap.size > 0) {
        const listToSave = Array.from(platformsToSaveMap.values())
        await storeRef.current.saveMultiplePlatforms(currentProfileId, listToSave)
      }

      await refreshPlatforms()
      triggerCloudSync()
    },
    [currentProfileId, platforms, refreshPlatforms, triggerCloudSync],
  )

  const value = useMemo(
    (): VaultContextValue => ({
      isReady,
      isInitialized,
      isUnlocked,
      platforms,
      profiles,
      currentProfileId,
      currentProfileName,
      listProfiles,
      createProfile,
      selectProfile,
      deleteCurrentProfile,
      logoutProfile,
      addPlatform,
      savePlatform,
      deletePlatform,
      addAccount,
      updateAccount,
      deleteAccount,
      exportBackup,
      importBackup,
      importMassiveAccounts,
      cloudUserEmail,
      cloudSyncStatus,
      cloudError,
      loginCloud,
      registerCloud,
      logoutCloud,
      syncActiveProfileToCloud,
      restoreProfileFromCloud,
    }),
    [
      isReady,
      isInitialized,
      isUnlocked,
      platforms,
      profiles,
      currentProfileId,
      currentProfileName,
      listProfiles,
      createProfile,
      selectProfile,
      deleteCurrentProfile,
      logoutProfile,
      addPlatform,
      savePlatform,
      deletePlatform,
      addAccount,
      updateAccount,
      deleteAccount,
      exportBackup,
      importBackup,
      importMassiveAccounts,
      cloudUserEmail,
      cloudSyncStatus,
      cloudError,
      loginCloud,
      registerCloud,
      logoutCloud,
      syncActiveProfileToCloud,
      restoreProfileFromCloud,
    ],
  )

  return (
    <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
  )
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault debe usarse dentro de VaultProvider')
  return ctx
}

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
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../services/firebase'
import { CryptoVault } from '../crypto/CryptoVault'
import { VaultStore } from '../storage/VaultStore'
import { getVaultDb } from '../storage/vaultDb'
import type { Account, Platform } from '../types'
import { generateId } from '../utils/id'

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
  // Estados y métodos de Sincronización en la Nube E2EE (Firebase)
  cloudUserEmail: string | null
  cloudSyncStatus: 'idle' | 'syncing' | 'synced' | 'error'
  cloudError: string | null
  cloudVaultExists: boolean | null
  loginCloud: (email: string, password: string) => Promise<void>
  registerCloud: (email: string, password: string) => Promise<void>
  loginWithGoogleCloud: () => Promise<void>
  logoutCloud: () => Promise<void>
  syncActiveProfileToCloud: () => Promise<void>
  restoreProfileFromCloud: (email: string, password: string, masterPassword: string) => Promise<void>
  restoreProfileFromGoogleCloud: (masterPassword: string) => Promise<void>
  initializeNewVault: (masterPassword: string) => Promise<void>
  unlockOrRestoreVault: (masterPassword: string) => Promise<void>
}

const VaultContext = createContext<VaultContextValue | null>(null)

export function VaultProvider({ children }: { children: ReactNode }) {
  const vaultRef = useRef(new CryptoVault())
  const storeRef = useRef(new VaultStore(vaultRef.current))

  const [isReady, setIsReady] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(false)
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

  // Estados de Sincronización en la Nube (Firebase)
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null)
  /** Ref interno para el usuario de Firebase Auth, evitando re-renders en callbacks de sync */
  const firebaseUserRef = useRef<User | null>(null)
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [cloudVaultExists, setCloudVaultExists] = useState<boolean | null>(null)

  /**
   * Escucha los cambios en el estado de autenticación de Firebase Auth.
   * Mantiene cloudUserEmail y firebaseUserRef sincronizados sin causar
   * re-renderizaciones innecesarias en los callbacks de sincronización.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      firebaseUserRef.current = user
      setCloudUserEmail(user?.email ?? null)
      if (user) {
        try {
          const docRef = doc(db, 'vaults', user.uid)
          const snap = await getDoc(docRef)
          setCloudVaultExists(snap.exists() && !!snap.data()?.encrypted_vault_blob)
        } catch (err) {
          console.error('Error al comprobar existencia de la bóveda:', err)
          setCloudVaultExists(false)
        }
      } else {
        setCloudVaultExists(null)
      }
      setIsAuthReady(true)
    })
    return () => unsubscribe()
  }, [])

  const loginCloud = useCallback(async (email: string, password: string) => {
    setCloudError(null)
    setCloudSyncStatus('syncing')
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      setCloudUserEmail(credential.user.email ?? 'Usuario Nube')
      setCloudSyncStatus('idle')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión en la nube.'
      setCloudSyncStatus('error')
      setCloudError(message)
      throw err
    }
  }, [])

  const registerCloud = useCallback(async (email: string, password: string) => {
    setCloudError(null)
    setCloudSyncStatus('syncing')
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      setCloudUserEmail(credential.user.email ?? 'Usuario Nube')
      setCloudSyncStatus('idle')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al registrar la cuenta en la nube.'
      setCloudSyncStatus('error')
      setCloudError(message)
      throw err
    }
  }, [])

  const loginWithGoogleCloud = useCallback(async () => {
    setCloudError(null)
    setCloudSyncStatus('syncing')
    try {
      const provider = new GoogleAuthProvider()
      const credential = await signInWithPopup(auth, provider)
      setCloudUserEmail(credential.user.email ?? 'Usuario Google')
      setCloudSyncStatus('idle')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión con Google.'
      setCloudSyncStatus('error')
      setCloudError(message)
      throw err
    }
  }, [])

  const logoutProfile = useCallback(() => {
    vaultRef.current.lock()
    setIsUnlocked(false)
    setCurrentProfileId(null)
    setCurrentProfileName(null)
    setPlatforms([])
  }, [])

  const logoutCloud = useCallback(async () => {
    setCloudError(null)
    try {
      await signOut(auth)
      setCloudUserEmail(null)
      setCloudSyncStatus('idle')
      logoutProfile()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cerrar sesión en la nube.'
      setCloudError(message)
      throw err
    }
  }, [logoutProfile])

  const syncActiveProfileToCloud = useCallback(async () => {
    const user = firebaseUserRef.current
    if (!currentProfileId || !user) {
      setCloudSyncStatus('idle')
      return
    }

    setCloudSyncStatus('syncing')
    setCloudError(null)
    try {
      const encryptedBlob = await storeRef.current.exportCloudPayload(currentProfileId)
      // Usamos el UID del usuario autenticado como ID del documento en Firestore.
      // Las Reglas de Seguridad de Firestore garantizan que solo el propietario
      // puede leer/escribir su propio documento.
      await setDoc(doc(db, 'vaults', user.uid), {
        encrypted_vault_blob: encryptedBlob,
        updated_at: new Date().toISOString(),
      })
      setCloudSyncStatus('synced')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al conectar con la nube.'
      console.error('Error al sincronizar con Firebase:', err)
      setCloudSyncStatus('error')
      setCloudError(message)
    }
  }, [currentProfileId])

  /**
   * Dispara la sincronización en segundo plano de forma silenciosa.
   * Los errores se registran en consola pero no interrumpen al usuario.
   */
  const triggerCloudSync = useCallback(() => {
    syncActiveProfileToCloud().catch((err) => {
      console.warn('Fallo silencioso en background sync:', err)
    })
  }, [syncActiveProfileToCloud])

  const restoreProfileFromCloud = useCallback(
    async (email: string, password: string, masterPassword: string) => {
      setCloudError(null)
      setCloudSyncStatus('syncing')

      let user: User
      try {
        const credential = await signInWithEmailAndPassword(auth, email, password)
        user = credential.user
        setCloudUserEmail(user.email ?? 'Usuario Nube')
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error de autenticación en la nube.'
        setCloudSyncStatus('error')
        setCloudError(message)
        throw err
      }

      try {
        const vaultDocRef = doc(db, 'vaults', user.uid)
        const vaultSnap = await getDoc(vaultDocRef)

        if (!vaultSnap.exists()) {
          throw new Error('No se encontraron datos de la bóveda en esta cuenta de la nube.')
        }

        const blob = vaultSnap.data()?.encrypted_vault_blob as string | undefined
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
          throw new Error('Error al desbloquear el perfil restaurado. Contraseña maestra incorrecta.')
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error en la restauración.'
        console.error('Error al restaurar desde Firebase:', err)
        setCloudSyncStatus('error')
        setCloudError(message)
        throw err
      }
    },
    [listProfiles],
  )

  const restoreProfileFromGoogleCloud = useCallback(
    async (masterPassword: string) => {
      setCloudError(null)
      setCloudSyncStatus('syncing')

      let user: User
      try {
        const provider = new GoogleAuthProvider()
        const credential = await signInWithPopup(auth, provider)
        user = credential.user
        setCloudUserEmail(credential.user.email ?? 'Usuario Google')
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error de autenticación con Google.'
        setCloudSyncStatus('error')
        setCloudError(message)
        throw err
      }

      try {
        const vaultDocRef = doc(db, 'vaults', user.uid)
        const vaultSnap = await getDoc(vaultDocRef)

        if (!vaultSnap.exists()) {
          throw new Error('No se encontraron datos de la bóveda en esta cuenta de Google.')
        }

        const blob = vaultSnap.data()?.encrypted_vault_blob as string | undefined
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
          throw new Error('Error al desbloquear el perfil restaurado. Contraseña maestra incorrecta.')
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error en la restauración.'
        console.error('Error al restaurar desde Firebase:', err)
        setCloudSyncStatus('error')
        setCloudError(message)
        throw err
      }
    },
    [listProfiles],
  )

  const initializeNewVault = useCallback(async (masterPassword: string) => {
    setCloudError(null)
    setCloudSyncStatus('syncing')
    try {
      const profileId = 'default'
      const profileName = 'Bóveda Principal'
      
      const dbInstance = await getVaultDb()
      await dbInstance.delete('meta', `profile_${profileId}`)
      
      const id = await storeRef.current.createProfile(profileName, masterPassword)
      
      const ok = await storeRef.current.unlockProfile(id, masterPassword)
      if (!ok) {
        throw new Error('No se pudo desbloquear la bóveda recién creada.')
      }
      
      setCurrentProfileId(id)
      setCurrentProfileName(profileName)
      setIsUnlocked(true)
      setPlatforms([])
      
      const encryptedBlob = await storeRef.current.exportCloudPayload(id)
      const user = firebaseUserRef.current
      if (user) {
        await setDoc(doc(db, 'vaults', user.uid), {
          encrypted_vault_blob: encryptedBlob,
          updated_at: new Date().toISOString(),
        })
        setCloudSyncStatus('synced')
        setCloudVaultExists(true)
      } else {
        throw new Error('Usuario no autenticado en la nube.')
      }
      
      await listProfiles()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al inicializar la bóveda.'
      console.error('Error al inicializar la bóveda:', err)
      setCloudSyncStatus('error')
      setCloudError(message)
      throw err
    }
  }, [listProfiles])

  const unlockOrRestoreVault = useCallback(async (masterPassword: string) => {
    setCloudError(null)
    setCloudSyncStatus('syncing')
    const profileId = 'default'
    const user = firebaseUserRef.current
    if (!user) {
      throw new Error('Usuario no autenticado en la nube.')
    }
    
    try {
      const dbInstance = await getVaultDb()
      const localProfile = await dbInstance.get('meta', `profile_${profileId}`)
      
      if (localProfile) {
        const success = await storeRef.current.unlockProfile(profileId, masterPassword)
        if (success) {
          setCurrentProfileId(profileId)
          setCurrentProfileName(localProfile.name || 'Bóveda Principal')
          setIsUnlocked(true)
          const loaded = await storeRef.current.loadAllPlatforms(profileId)
          setPlatforms(loaded)
          setCloudSyncStatus('synced')
          return
        }
        throw new Error('Contraseña maestra incorrecta.')
      }
      
      const docRef = doc(db, 'vaults', user.uid)
      const snap = await getDoc(docRef)
      if (!snap.exists()) {
        throw new Error('No se encontraron datos de la bóveda en la nube.')
      }
      
      const blob = snap.data()?.encrypted_vault_blob
      if (!blob) {
        throw new Error('El archivo de la bóveda en la nube está vacío.')
      }
      
      await storeRef.current.restoreCloudPayload(profileId, blob, masterPassword)
      const success = await storeRef.current.unlockProfile(profileId, masterPassword)
      if (success) {
        setCurrentProfileId(profileId)
        setCurrentProfileName('Bóveda Principal')
        setIsUnlocked(true)
        const loaded = await storeRef.current.loadAllPlatforms(profileId)
        setPlatforms(loaded)
        setCloudSyncStatus('synced')
        await listProfiles()
      } else {
        throw new Error('Contraseña maestra incorrecta para descifrar la bóveda descargada.')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al desbloquear la bóveda.'
      console.error('Error al desbloquear/restaurar:', err)
      setCloudSyncStatus('error')
      setCloudError(message)
      throw err
    }
  }, [listProfiles])

  // Obtener y listar perfiles iniciales.
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

  const createProfile = useCallback(
    async (name: string, password: string) => {
      const id = await storeRef.current.createProfile(name, password)
      await listProfiles()
      return id
    },
    [listProfiles],
  )

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

  const deleteCurrentProfile = useCallback(async () => {
    if (!currentProfileId) return
    const idToDelete = currentProfileId
    logoutProfile()
    await storeRef.current.deleteProfile(idToDelete)
    await listProfiles()
  }, [currentProfileId, logoutProfile, listProfiles])

  const savePlatform = useCallback(
    async (platform: Platform) => {
      if (!currentProfileId) return
      const updated: Platform = {
        ...platform,
        updatedAt: new Date().toISOString(),
      }
      await storeRef.current.savePlatform(currentProfileId, updated)
      await refreshPlatforms()
      triggerCloudSync()
    },
    [currentProfileId, refreshPlatforms, triggerCloudSync],
  )

  const addPlatform = useCallback(
    async (name: string) => {
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
    },
    [currentProfileId, refreshPlatforms, triggerCloudSync],
  )

  const deletePlatform = useCallback(
    async (platformId: string) => {
      if (!currentProfileId) return
      await storeRef.current.deletePlatform(currentProfileId, platformId)
      await refreshPlatforms()
      triggerCloudSync()
    },
    [currentProfileId, refreshPlatforms, triggerCloudSync],
  )

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
          a.id === accountId ? { ...account, updatedAt: new Date().toISOString() } : a,
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

  const exportBackup = useCallback(
    async (masterPassword: string) => {
      if (!currentProfileId) throw new Error('Ningún perfil activo.')
      return await storeRef.current.exportBackup(currentProfileId, masterPassword)
    },
    [currentProfileId],
  )

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
      const currentPlatformsSnapshot = [...platforms]
      const platformsToSaveMap = new Map<string, Platform>()

      for (const item of parsedAccounts) {
        const platformNameTrimmed = item.platformName.trim()
        if (!platformNameTrimmed) continue

        const searchNameLower = platformNameTrimmed.toLowerCase()
        const platform =
          Array.from(platformsToSaveMap.values()).find(
            (p) => p.name.toLowerCase() === searchNameLower,
          ) || currentPlatformsSnapshot.find((p) => p.name.toLowerCase() === searchNameLower)

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

  const value = useMemo<VaultContextValue>(
    () => ({
      isReady: isReady && isAuthReady,
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
      cloudVaultExists,
      loginCloud,
      registerCloud,
      loginWithGoogleCloud,
      logoutCloud,
      syncActiveProfileToCloud,
      restoreProfileFromCloud,
      restoreProfileFromGoogleCloud,
      initializeNewVault,
      unlockOrRestoreVault,
    }),
    [
      isReady,
      isAuthReady,
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
      cloudVaultExists,
      loginCloud,
      registerCloud,
      loginWithGoogleCloud,
      logoutCloud,
      syncActiveProfileToCloud,
      restoreProfileFromCloud,
      restoreProfileFromGoogleCloud,
      initializeNewVault,
      unlockOrRestoreVault,
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

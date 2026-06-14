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
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore'
import { CryptoVault } from '../crypto/CryptoVault'
import { auth, db, firebaseConfigError } from '../services/firebase'
import { VaultStore } from '../storage/VaultStore'
import type { Identity, Platform } from '../types'
import { getFriendlyErrorMessage, logUnexpectedError } from '../utils/errors'
import { createIdentity, identityMatchesEmail, LOCAL_IDENTITY_EMAIL } from '../utils/identity'

interface VaultContextValue {
  isReady: boolean
  isInitialized: boolean
  isUnlocked: boolean
  identities: Identity[]
  profiles: { id: string; name: string; createdAt: string }[]
  currentProfileId: string | null
  currentProfileName: string | null
  appError: string | null
  clearAppError: () => void
  listProfiles: () => Promise<void>
  createProfile: (name: string, password: string) => Promise<string>
  selectProfile: (id: string, password: string) => Promise<boolean>
  deleteCurrentProfile: () => Promise<void>
  logoutProfile: () => void
  addIdentity: (email: string) => Promise<Identity>
  saveIdentity: (identity: Identity) => Promise<void>
  deleteIdentity: (identityId: string) => Promise<void>
  addPlatform: (identityId: string, platform: Platform) => Promise<void>
  updatePlatform: (identityId: string, platformId: string, platform: Platform) => Promise<void>
  deletePlatform: (identityId: string, platformId: string) => Promise<void>
  exportBackup: (masterPassword: string) => Promise<string>
  importBackup: (backupJsonString: string, masterPassword: string) => Promise<void>
  importMassiveAccounts: (parsedRows: Array<{ identityEmail: string; platform: Platform }>) => Promise<void>
  cloudUserEmail: string | null
  cloudSyncStatus: 'idle' | 'syncing' | 'synced' | 'error'
  cloudError: string | null
  cloudVaultExists: boolean | null
  loginWithGoogleCloud: () => Promise<void>
  logoutCloud: () => Promise<void>
  syncActiveProfileToCloud: () => Promise<void>
  restoreProfileFromCloud: (email: string, password: string, masterPassword: string) => Promise<void>
  restoreProfileFromGoogleCloud: (masterPassword: string) => Promise<void>
  initializeNewVault: (masterPassword: string) => Promise<void>
  unlockOrRestoreVault: (masterPassword: string) => Promise<void>
}

const VaultContext = createContext<VaultContextValue | null>(null)

function getFirebaseClients(): { authClient: Auth; dbClient: Firestore } {
  if (!auth || !db) {
    throw new Error(
      firebaseConfigError ??
        'Firebase no esta configurado correctamente. Revisa las variables de entorno del proyecto.',
    )
  }

  return { authClient: auth, dbClient: db }
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const vaultRef = useRef(new CryptoVault())
  const storeRef = useRef(new VaultStore(vaultRef.current))
  const firebaseUserRef = useRef<User | null>(null)

  const [isReady, setIsReady] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [identities, setIdentities] = useState<Identity[]>([])
  const [profiles, setProfiles] = useState<{ id: string; name: string; createdAt: string }[]>([])
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null)
  const [currentProfileName, setCurrentProfileName] = useState<string | null>(null)
  const [appError, setAppError] = useState<string | null>(firebaseConfigError)
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null)
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const [cloudError, setCloudError] = useState<string | null>(firebaseConfigError)
  const [cloudVaultExists, setCloudVaultExists] = useState<boolean | null>(null)

  const clearAppError = useCallback(() => setAppError(null), [])

  const reportAppError = useCallback((error: unknown, fallback: string) => {
    const message = getFriendlyErrorMessage(error, fallback)
    setAppError(message)
    return message
  }, [])

  const reportCloudError = useCallback((error: unknown, fallback: string) => {
    const message = getFriendlyErrorMessage(error, fallback)
    setCloudError(message)
    return message
  }, [])

  const listProfiles = useCallback(async () => {
    try {
      const list = await storeRef.current.listProfiles()
      setProfiles(list)
      setIsInitialized(list.length > 0)
      setAppError(null)
    } catch (error) {
      reportAppError(error, 'No se pudo leer la base de datos local.')
      setProfiles([])
      setIsInitialized(false)
    }
  }, [reportAppError])

  const refreshIdentities = useCallback(async () => {
    if (!currentProfileId) return

    try {
      const loaded = await storeRef.current.loadAllIdentities(currentProfileId)
      setIdentities(loaded.length > 0 ? loaded : [createIdentity()])
      setAppError(null)
    } catch (error) {
      setIdentities([])
      reportAppError(error, 'No se pudieron cargar las identidades guardadas.')
      throw error
    }
  }, [currentProfileId, reportAppError])

  useEffect(() => {
    let mounted = true
    void listProfiles().finally(() => {
      if (mounted) setIsReady(true)
    })
    return () => {
      mounted = false
    }
  }, [listProfiles])

  useEffect(() => {
    if (!auth || !db) {
      setIsAuthReady(true)
      setCloudVaultExists(null)
      return
    }

    const dbClient = db
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      firebaseUserRef.current = user
      setCloudUserEmail(user?.email ?? null)

      if (!user) {
        setCloudVaultExists(null)
        setIsAuthReady(true)
        return
      }

      try {
        const snapshot = await getDoc(doc(dbClient, 'vaults', user.uid))
        setCloudVaultExists(Boolean(snapshot.exists() && snapshot.data()?.encrypted_vault_blob))
      } catch (error) {
        logUnexpectedError('Error al comprobar existencia de la boveda', error)
        setCloudVaultExists(false)
        reportCloudError(error, 'No se pudo comprobar el estado de la boveda en la nube.')
      } finally {
        setIsAuthReady(true)
      }
    })

    return () => unsubscribe()
  }, [reportCloudError])

  const logoutProfile = useCallback(() => {
    vaultRef.current.lock()
    setIsUnlocked(false)
    setCurrentProfileId(null)
    setCurrentProfileName(null)
    setIdentities([])
    setAppError(null)
  }, [])

  const syncActiveProfileToCloud = useCallback(async () => {
    const user = firebaseUserRef.current
    if (!currentProfileId || !user) {
      setCloudSyncStatus('idle')
      return
    }

    setCloudSyncStatus('syncing')
    setCloudError(null)

    try {
      const { dbClient } = getFirebaseClients()
      const encryptedBlob = await storeRef.current.exportCloudPayload(currentProfileId)
      await setDoc(doc(dbClient, 'vaults', user.uid), {
        encrypted_vault_blob: encryptedBlob,
        updated_at: new Date().toISOString(),
      })
      setCloudSyncStatus('synced')
    } catch (error) {
      logUnexpectedError('Error al sincronizar con Firebase', error)
      setCloudSyncStatus('error')
      reportCloudError(error, 'No se pudo sincronizar la boveda con Firebase.')
      throw error
    }
  }, [currentProfileId, reportCloudError])

  const triggerCloudSync = useCallback(() => {
    void syncActiveProfileToCloud().catch((error) => {
      logUnexpectedError('Fallo silencioso en background sync', error)
    })
  }, [syncActiveProfileToCloud])

  const saveIdentity = useCallback(
    async (identity: Identity) => {
      if (!currentProfileId) return

      try {
        const updated = { ...identity, updatedAt: new Date().toISOString() }
        await storeRef.current.saveIdentity(currentProfileId, updated)
        await refreshIdentities()
        triggerCloudSync()
      } catch (error) {
        reportAppError(error, 'No se pudo guardar la identidad.')
        throw error
      }
    },
    [currentProfileId, refreshIdentities, reportAppError, triggerCloudSync],
  )

  const addIdentity = useCallback(
    async (email: string) => {
      if (!currentProfileId) throw new Error('No hay un perfil activo.')
      const existing = identities.find((identity) => identityMatchesEmail(identity, email))
      if (existing) return existing

      const identity = createIdentity(email)
      await storeRef.current.saveIdentity(currentProfileId, identity)
      await refreshIdentities()
      triggerCloudSync()
      return identity
    },
    [currentProfileId, identities, refreshIdentities, triggerCloudSync],
  )

  const deleteIdentity = useCallback(
    async (identityId: string) => {
      if (!currentProfileId) return
      await storeRef.current.deleteIdentity(currentProfileId, identityId)
      await refreshIdentities()
      triggerCloudSync()
    },
    [currentProfileId, refreshIdentities, triggerCloudSync],
  )

  const addPlatform = useCallback(
    async (identityId: string, platform: Platform) => {
      const identity = identities.find((item) => item.id === identityId)
      if (!identity) throw new Error('La identidad seleccionada ya no existe.')
      await saveIdentity({
        ...identity,
        platforms: [...identity.platforms, { ...platform, updatedAt: new Date().toISOString() }],
      })
    },
    [identities, saveIdentity],
  )

  const updatePlatform = useCallback(
    async (identityId: string, platformId: string, platform: Platform) => {
      const identity = identities.find((item) => item.id === identityId)
      if (!identity) throw new Error('La identidad seleccionada ya no existe.')
      await saveIdentity({
        ...identity,
        platforms: identity.platforms.map((item) =>
          item.id === platformId ? { ...platform, updatedAt: new Date().toISOString() } : item,
        ),
      })
    },
    [identities, saveIdentity],
  )

  const deletePlatform = useCallback(
    async (identityId: string, platformId: string) => {
      const identity = identities.find((item) => item.id === identityId)
      if (!identity) throw new Error('La identidad seleccionada ya no existe.')
      await saveIdentity({
        ...identity,
        platforms: identity.platforms.filter((item) => item.id !== platformId),
      })
    },
    [identities, saveIdentity],
  )

  const importMassiveAccounts = useCallback(
    async (parsedRows: Array<{ identityEmail: string; platform: Platform }>) => {
      if (!currentProfileId) return

      try {
        const byEmail = new Map<string, Identity>()
        for (const identity of identities) {
          byEmail.set(identity.email.toLowerCase(), {
            ...identity,
            platforms: [...identity.platforms],
          })
        }

        for (const row of parsedRows) {
          const email = row.identityEmail.trim() || LOCAL_IDENTITY_EMAIL
          const key = email.toLowerCase()
          const identity = byEmail.get(key) ?? createIdentity(email)
          identity.platforms.push(row.platform)
          identity.updatedAt = new Date().toISOString()
          byEmail.set(key, identity)
        }

        await storeRef.current.saveMultipleIdentities(currentProfileId, Array.from(byEmail.values()))
        await refreshIdentities()
        triggerCloudSync()
      } catch (error) {
        reportAppError(error, 'No se pudo completar la importacion masiva.')
        throw error
      }
    },
    [currentProfileId, identities, refreshIdentities, reportAppError, triggerCloudSync],
  )

  const loginWithGoogleCloud = useCallback(async () => {
    setCloudError(null)
    setCloudSyncStatus('syncing')
    try {
      const { authClient } = getFirebaseClients()
      const provider = new GoogleAuthProvider()
      const credential = await signInWithPopup(authClient, provider)
      setCloudUserEmail(credential.user.email ?? 'Usuario Google')
      setCloudSyncStatus('idle')
    } catch (error) {
      setCloudSyncStatus('error')
      reportCloudError(error, 'No se pudo iniciar sesion con Google.')
      throw error
    }
  }, [reportCloudError])

  const logoutCloud = useCallback(async () => {
    setCloudError(null)
    try {
      const { authClient } = getFirebaseClients()
      await signOut(authClient)
      setCloudUserEmail(null)
      setCloudSyncStatus('idle')
      logoutProfile()
    } catch (error) {
      reportCloudError(error, 'No se pudo cerrar la sesion en la nube.')
      throw error
    }
  }, [logoutProfile, reportCloudError])

  const restoreIntoDefaultProfile = useCallback(
    async (blob: string, masterPassword: string, fallbackName: string) => {
      const targetProfileId = 'default'
      await storeRef.current.restoreCloudPayload(targetProfileId, blob, masterPassword)
      const success = await storeRef.current.unlockProfile(targetProfileId, masterPassword)
      if (!success) throw new Error('La contraseña maestra no coincide con la boveda cifrada.')

      setCurrentProfileId(targetProfileId)
      setCurrentProfileName(fallbackName)
      setIsUnlocked(true)
      const loaded = await storeRef.current.loadAllIdentities(targetProfileId)
      setIdentities(loaded.length > 0 ? loaded : [createIdentity()])
      setCloudSyncStatus('synced')
      await listProfiles()
    },
    [listProfiles],
  )

  const restoreProfileFromCloud = useCallback(async () => {
    throw new Error('El acceso por email y contraseña ya no esta soportado. Usa Google.')
  }, [])

  const restoreProfileFromGoogleCloud = useCallback(
    async (masterPassword: string) => {
      setCloudError(null)
      setCloudSyncStatus('syncing')
      try {
        const { authClient, dbClient } = getFirebaseClients()
        const provider = new GoogleAuthProvider()
        const credential = await signInWithPopup(authClient, provider)
        const snapshot = await getDoc(doc(dbClient, 'vaults', credential.user.uid))
        const blob = snapshot.data()?.encrypted_vault_blob as string | undefined
        if (!snapshot.exists() || !blob) throw new Error('No se encontro una boveda valida en Google.')
        await restoreIntoDefaultProfile(blob, masterPassword, 'Boveda Restaurada')
      } catch (error) {
        setCloudSyncStatus('error')
        reportCloudError(error, 'No se pudo restaurar la boveda desde Google.')
        throw error
      }
    },
    [reportCloudError, restoreIntoDefaultProfile],
  )

  const initializeNewVault = useCallback(
    async (masterPassword: string) => {
      setCloudError(null)
      setCloudSyncStatus('syncing')
      try {
        const { dbClient } = getFirebaseClients()
        const user = firebaseUserRef.current
        if (!user) throw new Error('No hay una sesion valida en Firebase.')

        const profileName = 'Boveda Principal'
        const profileId = await storeRef.current.createProfile(profileName, masterPassword)
        const unlocked = await storeRef.current.unlockProfile(profileId, masterPassword)
        if (!unlocked) throw new Error('La boveda nueva no pudo desbloquearse.')

        const localIdentity = createIdentity()
        await storeRef.current.saveIdentity(profileId, localIdentity)
        setCurrentProfileId(profileId)
        setCurrentProfileName(profileName)
        setIsUnlocked(true)
        setIdentities([localIdentity])

        const encryptedBlob = await storeRef.current.exportCloudPayload(profileId)
        await setDoc(doc(dbClient, 'vaults', user.uid), {
          encrypted_vault_blob: encryptedBlob,
          updated_at: new Date().toISOString(),
        })
        setCloudSyncStatus('synced')
        setCloudVaultExists(true)
        await listProfiles()
      } catch (error) {
        setCloudSyncStatus('error')
        reportCloudError(error, 'No se pudo crear la boveda inicial.')
        throw error
      }
    },
    [listProfiles, reportCloudError],
  )

  const unlockOrRestoreVault = useCallback(
    async (masterPassword: string) => {
      setCloudError(null)
      setCloudSyncStatus('syncing')
      try {
        const { dbClient } = getFirebaseClients()
        const user = firebaseUserRef.current
        if (!user) throw new Error('No hay una sesion valida en Firebase.')

        const profileId = 'default'
        const knownProfiles = await storeRef.current.listProfiles()
        const localDefaultProfile = knownProfiles.find((profile) => profile.id === profileId)

        if (localDefaultProfile) {
          const unlocked = await storeRef.current.unlockProfile(profileId, masterPassword)
          if (!unlocked) throw new Error('Contraseña maestra incorrecta.')
          setCurrentProfileId(profileId)
          setCurrentProfileName(localDefaultProfile.name || 'Boveda Principal')
          setIsUnlocked(true)
          const loaded = await storeRef.current.loadAllIdentities(profileId)
          setIdentities(loaded.length > 0 ? loaded : [createIdentity()])
          setCloudSyncStatus('synced')
          return
        }

        const snapshot = await getDoc(doc(dbClient, 'vaults', user.uid))
        const blob = snapshot.data()?.encrypted_vault_blob as string | undefined
        if (!snapshot.exists() || !blob) throw new Error('No se encontro una boveda en la nube.')
        await restoreIntoDefaultProfile(blob, masterPassword, 'Boveda Principal')
      } catch (error) {
        setCloudSyncStatus('error')
        reportCloudError(error, 'No se pudo desbloquear ni restaurar la boveda.')
        throw error
      }
    },
    [reportCloudError, restoreIntoDefaultProfile],
  )

  const createProfile = useCallback(
    async (name: string, password: string) => {
      const id = await storeRef.current.createProfile(name, password)
      await listProfiles()
      return id
    },
    [listProfiles],
  )

  const selectProfile = useCallback(
    async (id: string, password: string) => {
      const success = await storeRef.current.unlockProfile(id, password)
      if (!success) return false
      const list = await storeRef.current.listProfiles()
      const profile = list.find((item) => item.id === id)
      setCurrentProfileId(id)
      setCurrentProfileName(profile?.name ?? 'Usuario')
      setIsUnlocked(true)
      const loaded = await storeRef.current.loadAllIdentities(id)
      setIdentities(loaded.length > 0 ? loaded : [createIdentity()])
      setAppError(null)
      return true
    },
    [],
  )

  const deleteCurrentProfile = useCallback(async () => {
    if (!currentProfileId) return
    const profileIdToDelete = currentProfileId
    logoutProfile()
    await storeRef.current.deleteProfile(profileIdToDelete)
    await listProfiles()
  }, [currentProfileId, listProfiles, logoutProfile])

  const exportBackup = useCallback(
    async (masterPassword: string) => {
      if (!currentProfileId) throw new Error('No hay un perfil activo para exportar.')
      return await storeRef.current.exportBackup(currentProfileId, masterPassword)
    },
    [currentProfileId],
  )

  const importBackup = useCallback(
    async (backupJsonString: string, masterPassword: string) => {
      if (!currentProfileId) throw new Error('No hay un perfil activo para restaurar datos.')
      await storeRef.current.importBackup(currentProfileId, backupJsonString, masterPassword)
      await storeRef.current.unlockProfile(currentProfileId, masterPassword)
      await refreshIdentities()
      triggerCloudSync()
    },
    [currentProfileId, refreshIdentities, triggerCloudSync],
  )

  const value = useMemo<VaultContextValue>(
    () => ({
      isReady: isReady && isAuthReady,
      isInitialized,
      isUnlocked,
      identities,
      profiles,
      currentProfileId,
      currentProfileName,
      appError,
      clearAppError,
      listProfiles,
      createProfile,
      selectProfile,
      deleteCurrentProfile,
      logoutProfile,
      addIdentity,
      saveIdentity,
      deleteIdentity,
      addPlatform,
      updatePlatform,
      deletePlatform,
      exportBackup,
      importBackup,
      importMassiveAccounts,
      cloudUserEmail,
      cloudSyncStatus,
      cloudError,
      cloudVaultExists,
      loginWithGoogleCloud,
      logoutCloud,
      syncActiveProfileToCloud,
      restoreProfileFromCloud,
      restoreProfileFromGoogleCloud,
      initializeNewVault,
      unlockOrRestoreVault,
    }),
    [
      addIdentity,
      addPlatform,
      appError,
      clearAppError,
      cloudError,
      cloudSyncStatus,
      cloudUserEmail,
      cloudVaultExists,
      createProfile,
      currentProfileId,
      currentProfileName,
      deleteCurrentProfile,
      deleteIdentity,
      deletePlatform,
      exportBackup,
      identities,
      importBackup,
      importMassiveAccounts,
      initializeNewVault,
      isAuthReady,
      isInitialized,
      isReady,
      isUnlocked,
      listProfiles,
      loginWithGoogleCloud,
      logoutCloud,
      logoutProfile,
      profiles,
      restoreProfileFromCloud,
      restoreProfileFromGoogleCloud,
      saveIdentity,
      selectProfile,
      syncActiveProfileToCloud,
      unlockOrRestoreVault,
      updatePlatform,
    ],
  )

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
}

export function useVault(): VaultContextValue {
  const context = useContext(VaultContext)
  if (!context) throw new Error('useVault debe usarse dentro de VaultProvider')
  return context
}

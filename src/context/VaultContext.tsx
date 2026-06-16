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
  deleteUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import { deleteDoc, doc, getDoc, setDoc, type Firestore } from 'firebase/firestore'
import { CryptoVault } from '../crypto/CryptoVault'
import { auth, db, firebaseConfigError } from '../services/firebase'
import { VaultStore } from '../storage/VaultStore'
import { deleteVaultDb } from '../storage/vaultDb'
import type { Identity, LocalVaultItem, Platform } from '../types'
import { getFriendlyErrorMessage, logUnexpectedError } from '../utils/errors'
import { createIdentity, identityMatchesEmail, LOCAL_IDENTITY_EMAIL } from '../utils/identity'
import { normalizeLocalVaultItem } from '../utils/vaultItem'

interface VaultContextValue {
  isReady: boolean
  isInitialized: boolean
  isUnlocked: boolean
  identities: Identity[]
  localItems: LocalVaultItem[]
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
  saveLocalItem: (item: LocalVaultItem) => Promise<void>
  deleteLocalItem: (itemId: string) => Promise<void>
  exportBackup: (masterPassword: string) => Promise<string>
  verifyCurrentMasterPassword: (masterPassword: string) => Promise<boolean>
  changeCurrentMasterPassword: (currentPassword: string, nextPassword: string, recoveryPhrase: string) => Promise<void>
  importBackup: (backupJsonString: string, masterPassword: string) => Promise<void>
  importMassiveAccounts: (parsedRows: Array<{ identityEmail: string; platform: Platform }>) => Promise<string | null>
  cloudUserEmail: string | null
  cloudSyncStatus: 'idle' | 'syncing' | 'synced' | 'error'
  cloudError: string | null
  cloudVaultExists: boolean | null
  loginWithGoogleCloud: () => Promise<void>
  logoutCloud: () => Promise<void>
  syncActiveProfileToCloud: () => Promise<CloudSyncResult>
  downloadLatestCloudVault: () => Promise<CloudSyncResult>
  restoreProfileFromCloud: (email: string, password: string, masterPassword: string) => Promise<void>
  restoreProfileFromGoogleCloud: (masterPassword: string) => Promise<void>
  initializeNewVault: (masterPassword: string, recoveryPhrase: string) => Promise<void>
  unlockOrRestoreVault: (masterPassword: string) => Promise<void>
  recoverVaultWithSeed: (recoveryPhrase: string, newMasterPassword: string) => Promise<void>
  nukeAccount: () => Promise<void>
}

export interface CloudSyncResult {
  action: 'idle' | 'uploaded' | 'downloaded' | 'download_available'
  message: string
  cloudUpdatedAt?: string | null
  localUpdatedAt?: string | null
  cloudIdentityCount?: number
  cloudPlatformCount?: number
  cloudLocalItemCount?: number
  localIdentityCount?: number
  localPlatformCount?: number
  localLocalItemCount?: number
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
  const [localItems, setLocalItems] = useState<LocalVaultItem[]>([])
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

  const refreshVaultData = useCallback(async () => {
    if (!currentProfileId) return

    try {
      const [loadedIdentities, loadedLocalItems] = await Promise.all([
        storeRef.current.loadAllIdentities(currentProfileId),
        storeRef.current.loadLocalItems(currentProfileId),
      ])
      setIdentities(loadedIdentities.length > 0 ? loadedIdentities : [createIdentity()])
      setLocalItems(loadedLocalItems)
      setAppError(null)
    } catch (error) {
      setIdentities([])
      setLocalItems([])
      reportAppError(error, 'No se pudieron cargar los secretos guardados.')
      throw error
    }
  }, [currentProfileId, reportAppError])

  const loadVaultDataForProfile = useCallback(async (profileId: string) => {
    const [loadedIdentities, loadedLocalItems] = await Promise.all([
      storeRef.current.loadAllIdentities(profileId),
      storeRef.current.loadLocalItems(profileId),
    ])
    setIdentities(loadedIdentities.length > 0 ? loadedIdentities : [createIdentity()])
    setLocalItems(loadedLocalItems)
  }, [])

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
    setLocalItems([])
    setAppError(null)
  }, [])

  const getLocalVaultUpdatedAt = useCallback(() => {
    const timestamps = [
      ...identities.flatMap((identity) => [
        identity.updatedAt,
        identity.createdAt,
        ...identity.platforms.flatMap((platform) => [platform.updatedAt, platform.createdAt]),
      ]),
      ...localItems.flatMap((item) => [item.updatedAt, item.createdAt]),
    ].filter(Boolean)

    return timestamps.reduce((latest, value) => {
      const time = Date.parse(value)
      return Number.isFinite(time) ? Math.max(latest, time) : latest
    }, 0)
  }, [identities, localItems])

  const getLocalVaultCounts = useCallback(() => ({
    identityCount: identities.length,
    platformCount: identities.reduce((total, identity) => total + identity.platforms.length, 0),
    localItemCount: localItems.length,
  }), [identities, localItems])

  const uploadActiveProfileToCloud = useCallback(async () => {
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
      setCloudVaultExists(true)
      setCloudSyncStatus('synced')
    } catch (error) {
      logUnexpectedError('Error al sincronizar con Firebase', error)
      setCloudSyncStatus('error')
      reportCloudError(error, 'No se pudo sincronizar la boveda con Firebase.')
      throw error
    }
  }, [currentProfileId, reportCloudError])

  const downloadLatestCloudVault = useCallback(async (): Promise<CloudSyncResult> => {
    const user = firebaseUserRef.current
    if (!currentProfileId || !user) {
      setCloudSyncStatus('idle')
      return { action: 'idle', message: 'No hay una sesión de nube activa para sincronizar.' }
    }

    setCloudSyncStatus('syncing')
    setCloudError(null)

    try {
      const { dbClient } = getFirebaseClients()
      const snapshot = await getDoc(doc(dbClient, 'vaults', user.uid))
      const cloudBlob = snapshot.data()?.encrypted_vault_blob as string | undefined
      if (!snapshot.exists() || !cloudBlob) {
        setCloudSyncStatus('idle')
        return { action: 'idle', message: 'No se encontró una bóveda en la nube para descargar.' }
      }

      const cloudSummary = await storeRef.current.inspectCloudPayloadWithActiveSession(cloudBlob)
      await storeRef.current.restoreCloudPayloadWithActiveSession(currentProfileId, cloudBlob)
      await refreshVaultData()
      setCloudVaultExists(true)
      setCloudSyncStatus('synced')
      return {
        action: 'downloaded',
        message: `Sincronización completada. Se descargaron ${cloudSummary.platformCount} contraseña${cloudSummary.platformCount !== 1 ? 's' : ''} y ${cloudSummary.localItemCount} secreto${cloudSummary.localItemCount !== 1 ? 's' : ''} local${cloudSummary.localItemCount !== 1 ? 'es' : ''}.`,
        cloudUpdatedAt: snapshot.data()?.updated_at ?? null,
        cloudIdentityCount: cloudSummary.identityCount,
        cloudPlatformCount: cloudSummary.platformCount,
        cloudLocalItemCount: cloudSummary.localItemCount,
      }
    } catch (error) {
      logUnexpectedError('Error al descargar desde Firebase', error)
      setCloudSyncStatus('error')
      reportCloudError(error, 'No se pudo descargar la bóveda desde Firebase.')
      throw error
    }
  }, [currentProfileId, refreshVaultData, reportCloudError])

  const syncActiveProfileToCloud = useCallback(async (): Promise<CloudSyncResult> => {
    const user = firebaseUserRef.current
    if (!currentProfileId || !user) {
      setCloudSyncStatus('idle')
      return { action: 'idle', message: 'Conecta Google Cloud para sincronizar esta bóveda.' }
    }

    setCloudSyncStatus('syncing')
    setCloudError(null)

    try {
      const { dbClient } = getFirebaseClients()
      const vaultRefDoc = doc(dbClient, 'vaults', user.uid)
      const snapshot = await getDoc(vaultRefDoc)
      const cloudBlob = snapshot.data()?.encrypted_vault_blob as string | undefined
      const cloudUpdatedAt = Date.parse(String(snapshot.data()?.updated_at ?? '')) || 0
      const localUpdatedAt = getLocalVaultUpdatedAt()
      const localCounts = getLocalVaultCounts()

      if (snapshot.exists() && cloudBlob && cloudUpdatedAt > localUpdatedAt + 1000) {
        const cloudSummary = await storeRef.current.inspectCloudPayloadWithActiveSession(cloudBlob)
        setCloudVaultExists(true)
        setCloudSyncStatus('idle')
        return {
          action: 'download_available',
          message: `Detectadas ${cloudSummary.platformCount} contraseña${cloudSummary.platformCount !== 1 ? 's' : ''} y ${cloudSummary.localItemCount} secreto${cloudSummary.localItemCount !== 1 ? 's' : ''} local${cloudSummary.localItemCount !== 1 ? 'es' : ''} en la nube. Puedes descargarlas ahora sin perder visibilidad del origen.`,
          cloudUpdatedAt: snapshot.data()?.updated_at ?? null,
          localUpdatedAt: localUpdatedAt ? new Date(localUpdatedAt).toISOString() : null,
          cloudIdentityCount: cloudSummary.identityCount,
          cloudPlatformCount: cloudSummary.platformCount,
          cloudLocalItemCount: cloudSummary.localItemCount,
          localIdentityCount: localCounts.identityCount,
          localPlatformCount: localCounts.platformCount,
          localLocalItemCount: localCounts.localItemCount,
        }
      }

      const encryptedBlob = await storeRef.current.exportCloudPayload(currentProfileId)
      await setDoc(vaultRefDoc, {
        encrypted_vault_blob: encryptedBlob,
        updated_at: new Date().toISOString(),
      })
      setCloudVaultExists(true)
      setCloudSyncStatus('synced')
      return {
        action: 'uploaded',
        message: `Bóveda subida a la nube. ${localCounts.platformCount} contraseña${localCounts.platformCount !== 1 ? 's' : ''} y ${localCounts.localItemCount} secreto${localCounts.localItemCount !== 1 ? 's' : ''} local${localCounts.localItemCount !== 1 ? 'es' : ''} protegidos.`,
        localUpdatedAt: localUpdatedAt ? new Date(localUpdatedAt).toISOString() : null,
        localIdentityCount: localCounts.identityCount,
        localPlatformCount: localCounts.platformCount,
        localLocalItemCount: localCounts.localItemCount,
      }
    } catch (error) {
      logUnexpectedError('Error al sincronizar con Firebase', error)
      setCloudSyncStatus('error')
      reportCloudError(error, 'No se pudo sincronizar la boveda con Firebase.')
      throw error
    }
  }, [currentProfileId, getLocalVaultCounts, getLocalVaultUpdatedAt, reportCloudError])

  const triggerCloudSync = useCallback(() => {
    void uploadActiveProfileToCloud().catch((error) => {
      logUnexpectedError('Fallo silencioso en background sync', error)
    })
  }, [uploadActiveProfileToCloud])

  const saveIdentity = useCallback(
    async (identity: Identity) => {
      if (!currentProfileId) return

      try {
        const updated = { ...identity, updatedAt: new Date().toISOString() }
        await storeRef.current.saveIdentity(currentProfileId, updated)
        await refreshVaultData()
        triggerCloudSync()
      } catch (error) {
        reportAppError(error, 'No se pudo guardar la identidad.')
        throw error
      }
    },
    [currentProfileId, refreshVaultData, reportAppError, triggerCloudSync],
  )

  const addIdentity = useCallback(
    async (email: string) => {
      if (!currentProfileId) throw new Error('No hay un perfil activo.')
      const existing = identities.find((identity) => identityMatchesEmail(identity, email))
      if (existing) return existing

      const identity = createIdentity(email)
      await storeRef.current.saveIdentity(currentProfileId, identity)
      await refreshVaultData()
      triggerCloudSync()
      return identity
    },
    [currentProfileId, identities, refreshVaultData, triggerCloudSync],
  )

  const deleteIdentity = useCallback(
    async (identityId: string) => {
      if (!currentProfileId) return
      await storeRef.current.deleteIdentity(currentProfileId, identityId)
      await refreshVaultData()
      triggerCloudSync()
    },
    [currentProfileId, refreshVaultData, triggerCloudSync],
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
      if (!currentProfileId) return null

      try {
        const byEmail = new Map<string, Identity>()
        let firstImportedIdentityId: string | null = null
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
          firstImportedIdentityId ??= identity.id
          identity.platforms.push(row.platform)
          identity.updatedAt = new Date().toISOString()
          byEmail.set(key, identity)
        }

        await storeRef.current.saveMultipleIdentities(currentProfileId, Array.from(byEmail.values()))
        await refreshVaultData()
        triggerCloudSync()
        return firstImportedIdentityId
      } catch (error) {
        reportAppError(error, 'No se pudo completar la importacion masiva.')
        throw error
      }
    },
    [currentProfileId, identities, refreshVaultData, reportAppError, triggerCloudSync],
  )

  const saveLocalItem = useCallback(
    async (item: LocalVaultItem) => {
      if (!currentProfileId) return

      try {
        await storeRef.current.saveLocalItem(currentProfileId, normalizeLocalVaultItem(item))
        await refreshVaultData()
        triggerCloudSync()
      } catch (error) {
        reportAppError(error, 'No se pudo guardar el secreto local.')
        throw error
      }
    },
    [currentProfileId, refreshVaultData, reportAppError, triggerCloudSync],
  )

  const deleteLocalItem = useCallback(
    async (itemId: string) => {
      if (!currentProfileId) return
      try {
        await storeRef.current.deleteLocalItem(currentProfileId, itemId)
        await refreshVaultData()
        triggerCloudSync()
      } catch (error) {
        reportAppError(error, 'No se pudo eliminar el secreto local.')
        throw error
      }
    },
    [currentProfileId, refreshVaultData, reportAppError, triggerCloudSync],
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
      await loadVaultDataForProfile(targetProfileId)
      setCloudSyncStatus('synced')
      await listProfiles()
    },
    [listProfiles, loadVaultDataForProfile],
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
    async (masterPassword: string, recoveryPhrase: string) => {
      setCloudError(null)
      setCloudSyncStatus('syncing')
      try {
        const { dbClient } = getFirebaseClients()
        const user = firebaseUserRef.current
        if (!user) throw new Error('No hay una sesion valida en Firebase.')

        const profileName = 'Boveda Principal'
        const profileId = await storeRef.current.createProfile(profileName, masterPassword, recoveryPhrase)
        const unlocked = await storeRef.current.unlockProfile(profileId, masterPassword)
        if (!unlocked) throw new Error('La boveda nueva no pudo desbloquearse.')

        const localIdentity = createIdentity()
        await storeRef.current.saveIdentity(profileId, localIdentity)
        setCurrentProfileId(profileId)
        setCurrentProfileName(profileName)
        setIsUnlocked(true)
        setIdentities([localIdentity])
        setLocalItems([])

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
          await loadVaultDataForProfile(profileId)
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
    [loadVaultDataForProfile, reportCloudError, restoreIntoDefaultProfile],
  )

  const recoverVaultWithSeed = useCallback(
    async (recoveryPhrase: string, newMasterPassword: string) => {
      setCloudError(null)
      setCloudSyncStatus('syncing')
      let recoveredMasterPassword: string | null = null
      try {
        const { dbClient } = getFirebaseClients()
        const user = firebaseUserRef.current
        if (!user) throw new Error('No hay una sesion valida en Firebase.')

        const profileId = 'default'
        const knownProfiles = await storeRef.current.listProfiles()
        const localDefaultProfile = knownProfiles.find((profile) => profile.id === profileId)

        if (localDefaultProfile) {
          recoveredMasterPassword = await storeRef.current.recoverMasterPassword(profileId, recoveryPhrase)
        } else {
          const snapshot = await getDoc(doc(dbClient, 'vaults', user.uid))
          const blob = snapshot.data()?.encrypted_vault_blob as string | undefined
          if (!snapshot.exists() || !blob) throw new Error('No se encontro una boveda en la nube.')
          recoveredMasterPassword = await storeRef.current.recoverMasterPasswordFromCloudPayload(blob, recoveryPhrase)
          await restoreIntoDefaultProfile(blob, recoveredMasterPassword, 'Boveda Principal')
        }

        await storeRef.current.rotateProfilePassword(
          profileId,
          recoveredMasterPassword,
          newMasterPassword,
          recoveryPhrase,
        )
        setCurrentProfileId(profileId)
        setCurrentProfileName('Boveda Principal')
        setIsUnlocked(true)
        await loadVaultDataForProfile(profileId)
        triggerCloudSync()
        setCloudSyncStatus('synced')
        await listProfiles()
      } catch (error) {
        setCloudSyncStatus('error')
        reportCloudError(error, 'No se pudo recuperar la boveda con la frase semilla.')
        throw error
      } finally {
        recoveredMasterPassword = null
      }
    },
    [listProfiles, loadVaultDataForProfile, reportCloudError, restoreIntoDefaultProfile, triggerCloudSync],
  )

  const nukeAccount = useCallback(async () => {
    setCloudError(null)
    setCloudSyncStatus('syncing')
    const user = firebaseUserRef.current
    if (!user) throw new Error('No hay una sesion valida en Firebase.')

    try {
      const { dbClient } = getFirebaseClients()
      await deleteDoc(doc(dbClient, 'vaults', user.uid))
      await deleteUser(user)
      vaultRef.current.lock()
      await deleteVaultDb()
      firebaseUserRef.current = null
      setCloudUserEmail(null)
      setCloudVaultExists(null)
      setCloudSyncStatus('idle')
      setIsUnlocked(false)
      setCurrentProfileId(null)
      setCurrentProfileName(null)
      setIdentities([])
      setLocalItems([])
      setProfiles([])
      setIsInitialized(false)
      setAppError(null)
      await listProfiles()
    } catch (error) {
      setCloudSyncStatus('error')
      const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : ''
      if (code === 'auth/requires-recent-login') {
        const message = 'Firebase requiere una re-autenticacion reciente antes de destruir la cuenta. Cierra sesion, vuelve a entrar con Google y repite la accion.'
        setCloudError(message)
        throw new Error(message)
      }
      reportCloudError(error, 'No se pudo destruir la boveda y la cuenta.')
      throw error
    }
  }, [listProfiles, reportCloudError])

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
      await loadVaultDataForProfile(id)
      setAppError(null)
      return true
    },
    [loadVaultDataForProfile],
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

  const verifyCurrentMasterPassword = useCallback(
    async (masterPassword: string) => {
      if (!currentProfileId) throw new Error('No hay un perfil activo para verificar.')
      return storeRef.current.unlockProfile(currentProfileId, masterPassword)
    },
    [currentProfileId],
  )

  const changeCurrentMasterPassword = useCallback(
    async (currentPassword: string, nextPassword: string, recoveryPhrase: string) => {
      if (!currentProfileId) throw new Error('No hay un perfil activo para cambiar la contraseña.')
      await storeRef.current.rotateProfilePassword(
        currentProfileId,
        currentPassword,
        nextPassword,
        recoveryPhrase,
      )
      await refreshVaultData()
      triggerCloudSync()
    },
    [currentProfileId, refreshVaultData, triggerCloudSync],
  )

  const importBackup = useCallback(
    async (backupJsonString: string, masterPassword: string) => {
      if (!currentProfileId) throw new Error('No hay un perfil activo para restaurar datos.')
      await storeRef.current.importBackup(currentProfileId, backupJsonString, masterPassword)
      await storeRef.current.unlockProfile(currentProfileId, masterPassword)
      await refreshVaultData()
      triggerCloudSync()
    },
    [currentProfileId, refreshVaultData, triggerCloudSync],
  )

  const value = useMemo<VaultContextValue>(
    () => ({
      isReady: isReady && isAuthReady,
      isInitialized,
      isUnlocked,
      identities,
      localItems,
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
      saveLocalItem,
      deleteLocalItem,
      exportBackup,
      verifyCurrentMasterPassword,
      changeCurrentMasterPassword,
      importBackup,
      importMassiveAccounts,
      cloudUserEmail,
      cloudSyncStatus,
      cloudError,
      cloudVaultExists,
      loginWithGoogleCloud,
      logoutCloud,
      syncActiveProfileToCloud,
      downloadLatestCloudVault,
      restoreProfileFromCloud,
      restoreProfileFromGoogleCloud,
      initializeNewVault,
      unlockOrRestoreVault,
      recoverVaultWithSeed,
      nukeAccount,
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
      deleteLocalItem,
      deletePlatform,
      downloadLatestCloudVault,
      exportBackup,
      verifyCurrentMasterPassword,
      changeCurrentMasterPassword,
      identities,
      importBackup,
      importMassiveAccounts,
      initializeNewVault,
      isAuthReady,
      isInitialized,
      isReady,
      isUnlocked,
      localItems,
      listProfiles,
      loginWithGoogleCloud,
      logoutCloud,
      logoutProfile,
      profiles,
      restoreProfileFromCloud,
      restoreProfileFromGoogleCloud,
      recoverVaultWithSeed,
      nukeAccount,
      saveIdentity,
      saveLocalItem,
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

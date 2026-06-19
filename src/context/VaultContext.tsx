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
  signInWithRedirect,
  getRedirectResult,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import { deleteDoc, doc, getDoc, setDoc, type Firestore } from 'firebase/firestore'
import { CryptoVault } from '../crypto/CryptoVault'
import { auth, db, firebaseConfigError } from '../services/firebase'
import { VaultStore } from '../storage/VaultStore'
import { deleteVaultDb, isInMemoryFallbackActive } from '../storage/vaultDb'
import type { Identity, LocalCategory, LocalVaultItem, Platform } from '../types'
import { getFriendlyErrorMessage, logUnexpectedError } from '../utils/errors'
import { createIdentity, identityMatchesEmail, LOCAL_IDENTITY_EMAIL } from '../utils/identity'
import { normalizeLocalCategory, normalizeLocalVaultItem } from '../utils/vaultItem'
import { useToast } from '../components/ui/ToastProvider'
import { payloadsAreIdentical } from '../utils/hash'
import {
  isBiometricAvailable,
  registerBiometricCredential,
  unlockWithBiometrics,
  type BiometricBundle,
} from '../crypto/biometric'

interface VaultContextValue {
  isReady: boolean
  isInitialized: boolean
  isUnlocked: boolean
  identities: Identity[]
  localItems: LocalVaultItem[]
  localCategories: LocalCategory[]
  profiles: { id: string; name: string; createdAt: string }[]
  currentProfileId: string | null
  currentProfileName: string | null
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
  saveLocalCategory: (category: LocalCategory) => Promise<void>
  exportBackup: (masterPassword: string) => Promise<string>
  verifyCurrentMasterPassword: (masterPassword: string) => Promise<boolean>
  changeCurrentMasterPassword: (currentPassword: string, nextPassword: string, recoveryPhrase: string) => Promise<void>
  importBackup: (backupJsonString: string, masterPassword: string) => Promise<void>
  importMassiveAccounts: (parsedRows: Array<{ identityEmail: string; platform: Platform }>) => Promise<string | null>
  cloudUserEmail: string | null
  cloudSyncStatus: 'checking_storage' | 'idle' | 'syncing' | 'synced' | 'error'
  isInMemory: boolean
  cloudVaultExists: boolean | null
  hasUnsyncedChanges: boolean
  loginWithGoogleCloud: () => Promise<void>
  logoutCloud: () => Promise<void>
  syncActiveProfileToCloud: (silent?: boolean) => Promise<CloudSyncResult>
  downloadLatestCloudVault: () => Promise<CloudSyncResult>
  restoreProfileFromCloud: (email: string, password: string, masterPassword: string) => Promise<void>
  restoreProfileFromGoogleCloud: (masterPassword: string) => Promise<void>
  initializeNewVault: (masterPassword: string, recoveryPhrase: string) => Promise<void>
  unlockOrRestoreVault: (masterPassword: string) => Promise<void>
  recoverVaultWithSeed: (recoveryPhrase: string, newMasterPassword: string) => Promise<void>
  nukeAccount: () => Promise<void>
  // Biometric unlock
  biometricAvailable: boolean
  biometricRegistered: boolean
  registerBiometricUnlock: () => Promise<void>
  unlockWithBiometricSensor: () => Promise<void>
  disableBiometricUnlock: () => Promise<void>
}

export interface CloudSyncResult {
  action: 'idle' | 'uploaded' | 'downloaded' | 'download_available'
  message: string
  cloudUpdatedAt?: string | null
  localUpdatedAt?: string | null
  cloudIdentityCount?: number
  cloudPlatformCount?: number
  cloudLocalItemCount?: number
  cloudLocalCategoryCount?: number
  localIdentityCount?: number
  localPlatformCount?: number
  localLocalItemCount?: number
  localLocalCategoryCount?: number
  diffResult?: import('../types').SyncDiffResult
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ])
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const vaultRef = useRef(new CryptoVault())
  const storeRef = useRef(new VaultStore(vaultRef.current))
  const firebaseUserRef = useRef<User | null>(null)
  const syncInProgressRef = useRef(false)

  const [isReady, setIsReady] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [identities, setIdentities] = useState<Identity[]>([])
  const [localItems, setLocalItems] = useState<LocalVaultItem[]>([])
  const [localCategories, setLocalCategories] = useState<LocalCategory[]>([])
  const [profiles, setProfiles] = useState<{ id: string; name: string; createdAt: string }[]>([])
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null)
  const [currentProfileName, setCurrentProfileName] = useState<string | null>(null)
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null)
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'checking_storage' | 'idle' | 'syncing' | 'synced' | 'error'>('checking_storage')
  const [isInMemory, setIsInMemory] = useState(isInMemoryFallbackActive())
  const [cloudVaultExists, setCloudVaultExists] = useState<boolean | null>(null)
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricRegistered, setBiometricRegistered] = useState(false)

  const { showToast } = useToast()

  // Check biometric availability on mount
  useEffect(() => {
    void isBiometricAvailable().then(setBiometricAvailable)
  }, [])

  // Escuchar degradación de almacenamiento (Safari/WebKit fallback)
  useEffect(() => {
    const handleStorageDegraded = () => {
      setIsInMemory(true)
      setCloudSyncStatus('idle')
    }
    window.addEventListener('contras:storage-degraded', handleStorageDegraded)
    if (isInMemoryFallbackActive()) {
      setIsInMemory(true)
      setCloudSyncStatus('idle')
    }
    return () => {
      window.removeEventListener('contras:storage-degraded', handleStorageDegraded)
    }
  }, [])


  const reportAppError = useCallback((error: unknown, fallback: string) => {
    const message = getFriendlyErrorMessage(error, fallback)
    showToast(message, 'error')
    return message
  }, [showToast])

  const reportCloudError = useCallback((error: unknown, fallback: string) => {
    const message = getFriendlyErrorMessage(error, fallback)
    showToast(message, 'error')
    return message
  }, [showToast])

  const listProfiles = useCallback(async () => {
    try {
      const list = await storeRef.current.listProfiles()
      setProfiles(list)
      setIsInitialized(list.length > 0)
    } catch (error) {
      reportAppError(error, 'No se pudo leer la base de datos local.')
      setProfiles([])
      setIsInitialized(false)
    }
  }, [reportAppError])

  const refreshVaultData = useCallback(async () => {
    if (!currentProfileId) return

    try {
      const [loadedIdentities, loadedLocalItems, loadedLocalCategories] = await Promise.all([
        storeRef.current.loadAllIdentities(currentProfileId),
        storeRef.current.loadLocalItems(currentProfileId),
        storeRef.current.loadLocalCategories(currentProfileId),
      ])
      setIdentities(loadedIdentities.length > 0 ? loadedIdentities : [createIdentity()])
      setLocalItems(loadedLocalItems)
      setLocalCategories(loadedLocalCategories)
    } catch (error) {
      setIdentities([])
      setLocalItems([])
      setLocalCategories([])
      reportAppError(error, 'No se pudieron cargar los secretos guardados.')
      throw error
    }
  }, [currentProfileId, reportAppError])

  const loadVaultDataForProfile = useCallback(async (profileId: string) => {
    const [loadedIdentities, loadedLocalItems, loadedLocalCategories] = await Promise.all([
      storeRef.current.loadAllIdentities(profileId),
      storeRef.current.loadLocalItems(profileId),
      storeRef.current.loadLocalCategories(profileId),
    ])
    setIdentities(loadedIdentities.length > 0 ? loadedIdentities : [createIdentity()])
    setLocalItems(loadedLocalItems)
    setLocalCategories(loadedLocalCategories)
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
    
    // Process redirect result first if returning from Google Auth
    getRedirectResult(auth).then(async (credential) => {
      if (credential?.user) {
         setCloudUserEmail(credential.user.email ?? null)
         try {
           const snapshot = await getDoc(doc(dbClient, 'vaults', credential.user.uid))
           setCloudVaultExists(Boolean(snapshot.exists() && snapshot.data()?.encrypted_vault_blob))
         } catch (error) {
           logUnexpectedError('Error comprobando vault tras redirect', error)
         }
      }
    }).catch(error => {
      console.warn('Error en getRedirectResult:', error)
      reportCloudError(error, 'No se pudo completar el inicio de sesion con Google.')
    })

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      firebaseUserRef.current = user
      setCloudUserEmail(user?.email ?? null)

      if (!user) {
        setCloudVaultExists(null)
        setIsAuthReady(true)
        return
      }

      // IMPORTANTE: Ponemos isAuthReady a true de inmediato para no bloquear el arranque
      // de la interfaz local esperando consultas de red lentas a Firestore.
      setIsAuthReady(true)

      try {
        const snapshot = await getDoc(doc(dbClient, 'vaults', user.uid))
        setCloudVaultExists(Boolean(snapshot.exists() && snapshot.data()?.encrypted_vault_blob))
      } catch (error) {
        logUnexpectedError('Error al comprobar existencia de la boveda', error)
        setCloudVaultExists(false)
        reportCloudError(error, 'No se pudo comprobar el estado de la boveda en la nube.')
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
    setLocalCategories([])
  }, [])

  const getLocalVaultUpdatedAt = useCallback(() => {
    const timestamps = [
      ...identities.flatMap((identity) => [
        identity.updatedAt,
        identity.createdAt,
        ...identity.platforms.flatMap((platform) => [platform.updatedAt, platform.createdAt]),
      ]),
      ...localItems.flatMap((item) => [item.updatedAt, item.createdAt]),
      ...localCategories.flatMap((category) => [category.updatedAt ?? '', category.createdAt ?? '']),
    ].filter(Boolean)

    return timestamps.reduce((latest, value) => {
      const time = Date.parse(value)
      return Number.isFinite(time) ? Math.max(latest, time) : latest
    }, 0)
  }, [identities, localCategories, localItems])

  const getLocalVaultCounts = useCallback(() => ({
    identityCount: identities.length,
    platformCount: identities.reduce((total, identity) => total + identity.platforms.length, 0),
    localItemCount: localItems.length,
    localCategoryCount: localCategories.length,
  }), [identities, localCategories, localItems])



  const downloadLatestCloudVault = useCallback(async (): Promise<CloudSyncResult> => {
    if (syncInProgressRef.current) {
      return { action: 'idle', message: 'Sincronización en curso. Espera un momento.' }
    }

    const user = firebaseUserRef.current
    if (!currentProfileId || !user) {
      setCloudSyncStatus('idle')
      return { action: 'idle', message: 'No hay una sesión de nube activa para sincronizar.' }
    }

    syncInProgressRef.current = true
    setCloudSyncStatus('syncing')

    try {
      const { dbClient } = getFirebaseClients()
      const vaultRefDoc = doc(dbClient, 'vaults', user.uid)
      const snapshot = await withTimeout(
        getDoc(vaultRefDoc),
        10000,
        'La conexión con Google Cloud excedió el tiempo límite (10s) al descargar. Revisa tu conexión a internet.'
      )
      
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
        cloudLocalCategoryCount: cloudSummary.localCategoryCount,
      }
    } catch (error) {
      logUnexpectedError('Error al descargar desde Firebase', error)
      setCloudSyncStatus('error')
      reportCloudError(error, 'No se pudo descargar la bóveda desde Firebase.')
      throw error
    } finally {
      syncInProgressRef.current = false
    }
  }, [currentProfileId, refreshVaultData, reportCloudError])

  const syncActiveProfileToCloud = useCallback(async (silent = false): Promise<CloudSyncResult> => {
    if (syncInProgressRef.current) {
      return { action: 'idle', message: 'Sincronización en curso. Espera un momento.' }
    }

    const user = firebaseUserRef.current
    if (!currentProfileId || !user) {
      setCloudSyncStatus('idle')
      return { action: 'idle', message: 'Conecta Google Cloud para sincronizar esta bóveda.' }
    }

    syncInProgressRef.current = true
    setCloudSyncStatus('syncing')

    try {
      const { dbClient } = getFirebaseClients()
      const vaultRefDoc = doc(dbClient, 'vaults', user.uid)
      const snapshot = await withTimeout(
        getDoc(vaultRefDoc),
        10000,
        'La conexión con Google Cloud excedió el tiempo límite (10s) al comprobar la bóveda. Revisa tu conexión a internet.'
      )
      
      const cloudBlob = snapshot.data()?.encrypted_vault_blob as string | undefined
      const cloudUpdatedAt = Date.parse(String(snapshot.data()?.updated_at ?? '')) || 0
      const localUpdatedAt = getLocalVaultUpdatedAt()
      const localCounts = getLocalVaultCounts()

      if (snapshot.exists() && cloudBlob) {
        const cloudSummary = await storeRef.current.inspectCloudPayloadWithActiveSession(cloudBlob)
        
        // En modo in-memory (iOS/Safari degradado), el perfil local puede no existir
        // en la base de datos volátil. En ese caso tratamos local como vacío.
        let localPayload: any = null
        let localPayloadAvailable = true
        try {
          localPayload = await storeRef.current.getUnencryptedCloudPayload(currentProfileId)
        } catch (payloadError) {
          console.warn('No se pudo leer el payload local (probable modo in-memory):', payloadError)
          localPayloadAvailable = false
        }
        
        const isIdentical = localPayloadAvailable 
          ? await payloadsAreIdentical(localPayload, cloudSummary.rawDump)
          : false
        
        if (isIdentical) {
          setCloudVaultExists(true)
          setHasUnsyncedChanges(false)
          setCloudSyncStatus('synced')
          return { action: 'idle', message: 'La bóveda ya está sincronizada y es idéntica a la nube.' }
        }

        const localHasVaultData =
          localCounts.platformCount > 0 ||
          localCounts.localItemCount > 0 ||
          localCounts.localCategoryCount > 0
        const cloudHasVaultData =
          cloudSummary.platformCount > 0 ||
          cloudSummary.localItemCount > 0 ||
          cloudSummary.localCategoryCount > 0
        const cloudLooksNewer = cloudUpdatedAt > localUpdatedAt + 1000
        const localLooksEmpty = !localHasVaultData && cloudHasVaultData
        const cloudHasMoreData =
          cloudSummary.platformCount > localCounts.platformCount ||
          cloudSummary.localItemCount > localCounts.localItemCount ||
          cloudSummary.localCategoryCount > localCounts.localCategoryCount

        if (localLooksEmpty) {
          // Descarga silenciosa automática si el local está vacío y hay datos en la nube
          await storeRef.current.restoreCloudPayloadWithActiveSession(currentProfileId, cloudBlob)
          await refreshVaultData()
          setCloudVaultExists(true)
          setCloudSyncStatus('synced')
          return {
            action: 'downloaded',
            message: `Sincronización completada. Se descargaron ${cloudSummary.platformCount} contraseña${cloudSummary.platformCount !== 1 ? 's' : ''} y ${cloudSummary.localItemCount} secreto${cloudSummary.localItemCount !== 1 ? 's' : ''} local${cloudSummary.localItemCount !== 1 ? 'es' : ''} de forma automática.`,
            cloudUpdatedAt: snapshot.data()?.updated_at ?? null,
            localUpdatedAt: new Date().toISOString(),
            cloudIdentityCount: cloudSummary.identityCount,
            cloudPlatformCount: cloudSummary.platformCount,
            cloudLocalItemCount: cloudSummary.localItemCount,
            cloudLocalCategoryCount: cloudSummary.localCategoryCount,
            localIdentityCount: cloudSummary.identityCount,
            localPlatformCount: cloudSummary.platformCount,
            localLocalItemCount: cloudSummary.localItemCount,
            localLocalCategoryCount: cloudSummary.localCategoryCount,
          }
        }

        if (cloudLooksNewer || cloudHasMoreData || !isIdentical) {
          const decryptedCloud = await storeRef.current.inspectAndDecryptCloudPayload(cloudBlob)
          const localIdns = await storeRef.current.loadAllIdentities(currentProfileId)
          const localIts = await storeRef.current.loadLocalItems(currentProfileId)
          const localCats = await storeRef.current.loadLocalCategories(currentProfileId)
          const { computeSyncDiff } = await import('../utils/syncDiff')
          const diffResult = computeSyncDiff(
            localIdns, localIts, localCats,
            decryptedCloud.identities, decryptedCloud.localItems, decryptedCloud.localCategories
          )

          setCloudVaultExists(true)
          setCloudSyncStatus('idle')
          return {
            action: 'download_available',
            message: `Detectadas ${cloudSummary.platformCount} contraseña${cloudSummary.platformCount !== 1 ? 's' : ''}, ${cloudSummary.localItemCount} secreto${cloudSummary.localItemCount !== 1 ? 's' : ''} local${cloudSummary.localItemCount !== 1 ? 'es' : ''} y ${cloudSummary.localCategoryCount} sección${cloudSummary.localCategoryCount !== 1 ? 'es' : ''} en la nube. Descárgalas para traer al dispositivo lo que guardaste en otro sitio.`,
            cloudUpdatedAt: snapshot.data()?.updated_at ?? null,
            localUpdatedAt: localUpdatedAt ? new Date(localUpdatedAt).toISOString() : null,
            cloudIdentityCount: cloudSummary.identityCount,
            cloudPlatformCount: cloudSummary.platformCount,
            cloudLocalItemCount: cloudSummary.localItemCount,
            cloudLocalCategoryCount: cloudSummary.localCategoryCount,
            localIdentityCount: localCounts.identityCount,
            localPlatformCount: localCounts.platformCount,
            localLocalItemCount: localCounts.localItemCount,
            localLocalCategoryCount: localCounts.localCategoryCount,
            diffResult,
          }
        }
      }
      // Subida: intentar exportar el payload local para subir a la nube
      // En modo in-memory degradado, exportCloudPayload puede fallar si el perfil
      // no existe en la base de datos volátil.
      try {
        const encryptedBlob = await storeRef.current.exportCloudPayload(currentProfileId)
        await withTimeout(
          setDoc(vaultRefDoc, {
            encrypted_vault_blob: encryptedBlob,
            updated_at: new Date().toISOString(),
          }),
          10000,
          'La subida a Google Cloud excedió el tiempo límite (10s). Revisa tu conexión a internet.'
        )
        
        setCloudVaultExists(true)
        setCloudSyncStatus('synced')
        return {
          action: 'uploaded',
          message: `Bóveda subida a la nube. ${localCounts.platformCount} contraseña${localCounts.platformCount !== 1 ? 's' : ''}, ${localCounts.localItemCount} secreto${localCounts.localItemCount !== 1 ? 's' : ''} local${localCounts.localItemCount !== 1 ? 'es' : ''} y ${localCounts.localCategoryCount} sección${localCounts.localCategoryCount !== 1 ? 'es' : ''} protegidos.`,
          localUpdatedAt: localUpdatedAt ? new Date(localUpdatedAt).toISOString() : null,
          localIdentityCount: localCounts.identityCount,
          localPlatformCount: localCounts.platformCount,
          localLocalItemCount: localCounts.localItemCount,
          localLocalCategoryCount: localCounts.localCategoryCount,
        }
      } catch (uploadError) {
        console.warn('No se pudo exportar la bóveda local para subir (probable modo in-memory):', uploadError)
        setCloudSyncStatus('idle')
        return {
          action: 'idle',
          message: 'No se pudo subir la bóveda local. Restaura primero tus datos desde la nube para sincronizar este dispositivo.',
        }
      }
    } catch (error) {
      logUnexpectedError('Error al sincronizar con Firebase', error)
      setCloudSyncStatus('error')
      if (!silent) {
        reportCloudError(error, 'No se pudo sincronizar la boveda con Firebase.')
      }
      throw error
    } finally {
      syncInProgressRef.current = false
    }
  }, [currentProfileId, getLocalVaultCounts, getLocalVaultUpdatedAt, reportCloudError])

  // Boot and Sincronización State Machine
  useEffect(() => {
    if (!isReady || !isAuthReady) return

    // Storage and Auth are ready!
    if (isInMemoryFallbackActive()) {
      setIsInMemory(true)
      setCloudSyncStatus('idle')
      return
    }

    // Storage is persistent!
    const user = firebaseUserRef.current
    if (user && currentProfileId) {
      // Both user logged in and profile unlocked.
      // Trigger auto-sync!
      setCloudSyncStatus('syncing')
      void syncActiveProfileToCloud(true).then((result) => {
        if (result.action === 'downloaded' || result.action === 'uploaded' || result.action === 'idle') {
          setCloudSyncStatus('synced')
        } else if (result.action === 'download_available') {
          setCloudSyncStatus('idle')
          setHasUnsyncedChanges(true)
        }
      }).catch((err) => {
        logUnexpectedError('Auto sync failed at boot state machine', err)
        setCloudSyncStatus('error')
      })
    } else {
      // Local persistent storage, not logged in or profile not unlocked yet
      setCloudSyncStatus('idle')
    }
  }, [isReady, isAuthReady, currentProfileId, cloudUserEmail, syncActiveProfileToCloud])

  const triggerCloudSync = useCallback(() => {
    void syncActiveProfileToCloud(true).then(result => {
      // Si hay un download_available y estamos en triggerCloudSync (auto-push), 
      // no sobreescribimos y en su lugar notificamos de conflicto en la UI mediante un return
      if (result.action === 'download_available') {
        setHasUnsyncedChanges(true)
      } else if (result.action === 'uploaded' || result.action === 'idle') {
        setHasUnsyncedChanges(false)
      }
    }).catch((error) => {
      logUnexpectedError('Fallo silencioso en background sync', error)
      setHasUnsyncedChanges(true)
    })
  }, [syncActiveProfileToCloud])

  const saveIdentity = useCallback(
    async (identity: Identity) => {
      if (!currentProfileId) return

      try {
        const updated = { ...identity, updatedAt: new Date().toISOString() }
        await storeRef.current.saveIdentity(currentProfileId, updated)
        await refreshVaultData()
        setHasUnsyncedChanges(true)
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
      setHasUnsyncedChanges(true)
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
      setHasUnsyncedChanges(true)
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
      setHasUnsyncedChanges(true)
      triggerCloudSync()
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
      setHasUnsyncedChanges(true)
      triggerCloudSync()
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
      setHasUnsyncedChanges(true)
      triggerCloudSync()
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
        setHasUnsyncedChanges(true)
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
        setHasUnsyncedChanges(true)
        triggerCloudSync()
      } catch (error) {
        reportAppError(error, 'No se pudo eliminar el secreto local.')
        throw error
      }
    },
    [currentProfileId, refreshVaultData, reportAppError, triggerCloudSync],
  )

  const saveLocalCategory = useCallback(
    async (category: LocalCategory) => {
      if (!currentProfileId) return
      try {
        await storeRef.current.saveLocalCategory(currentProfileId, normalizeLocalCategory(category))
        await refreshVaultData()
        triggerCloudSync()
      } catch (error) {
        reportAppError(error, 'No se pudo guardar la sección local.')
        throw error
      }
    },
    [currentProfileId, refreshVaultData, reportAppError, triggerCloudSync],
  )

  const loginWithGoogleCloud = useCallback(async () => {
    setCloudSyncStatus('syncing')
    try {
      const { authClient } = getFirebaseClients()
      const provider = new GoogleAuthProvider()
      try {
        const credential = await signInWithPopup(authClient, provider)
        setCloudUserEmail(credential.user.email ?? 'Usuario Google')
        setCloudSyncStatus('idle')
      } catch (popupError: any) {
        console.warn('signInWithPopup falló, intentando signInWithRedirect:', popupError)
        // Check if it's a closed popup, maybe we shouldn't redirect automatically
        if (popupError.code === 'auth/popup-closed-by-user') {
          throw popupError
        }
        await signInWithRedirect(authClient, provider)
        // Redirigiendo, el resto del código no se ejecutará aquí
      }
    } catch (error) {
      setCloudSyncStatus('error')
      reportCloudError(error, 'No se pudo iniciar sesion con Google.')
      throw error
    }
  }, [reportCloudError])

  const logoutCloud = useCallback(async () => {
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
      setCloudSyncStatus('idle')
      await listProfiles()
    },
    [listProfiles, loadVaultDataForProfile],
  )

  const restoreProfileFromCloud = useCallback(async () => {
    throw new Error('El acceso por email y contraseña ya no esta soportado. Usa Google.')
  }, [])

  const restoreProfileFromGoogleCloud = useCallback(
    async (masterPassword: string) => {
      setCloudSyncStatus('syncing')
      try {
        const { authClient, dbClient } = getFirebaseClients()
        const provider = new GoogleAuthProvider()
        let credential
        try {
          credential = await signInWithPopup(authClient, provider)
        } catch (popupError: any) {
           console.warn('signInWithPopup falló, intentando signInWithRedirect:', popupError)
           if (popupError.code === 'auth/popup-closed-by-user') {
             throw popupError
           }
           await signInWithRedirect(authClient, provider)
           // Se detiene aquí porque la página redirige
           return
        }
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
        setLocalCategories([])

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
          setCloudSyncStatus('idle')
          // Check if biometric is registered for this profile
          void storeRef.current.hasBiometricBundle(profileId).then(setBiometricRegistered)
          triggerCloudSync()
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
    [loadVaultDataForProfile, reportCloudError, restoreIntoDefaultProfile, triggerCloudSync],
  )

  const recoverVaultWithSeed = useCallback(
    async (recoveryPhrase: string, newMasterPassword: string) => {
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

  const registerBiometricUnlock = useCallback(async () => {
    if (!currentProfileId || !cloudUserEmail) throw new Error('No hay un perfil activo.')
    const bundle = await registerBiometricCredential(
      // We need the master password - we get it from the vault by verifying again
      // Actually, we need to keep it in a secure ephemeral ref during the session
      // For now, we expose a simpler flow: user must re-type password once to register biometric
      // This is handled in the UI: SettingsModal asks for password before calling this
      (window as any).__contras_ephemeral_pw__ ?? '',
      currentProfileId,
      cloudUserEmail,
    )
    await storeRef.current.saveBiometricBundle(bundle)
    setBiometricRegistered(true)
    // Clean ephemeral password immediately
    delete (window as any).__contras_ephemeral_pw__
  }, [currentProfileId, cloudUserEmail])

  const unlockWithBiometricSensor = useCallback(async () => {
    const profileId = 'default'
    const bundle = await storeRef.current.loadBiometricBundle(profileId)
    if (!bundle) throw new Error('No hay credencial biométrica registrada.')
    const masterPassword = await unlockWithBiometrics(bundle as BiometricBundle)
    await unlockOrRestoreVault(masterPassword)
  }, [unlockOrRestoreVault])

  const disableBiometricUnlock = useCallback(async () => {
    if (!currentProfileId) return
    await storeRef.current.deleteBiometricBundle(currentProfileId)
    setBiometricRegistered(false)
  }, [currentProfileId])

  const nukeAccount = useCallback(async () => {
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
      setLocalCategories([])
      setProfiles([])
      setIsInitialized(false)
      await listProfiles()
    } catch (error) {
      setCloudSyncStatus('error')
      const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : ''
      if (code === 'auth/requires-recent-login') {
        const message = 'Firebase requiere una re-autenticacion reciente antes de destruir la cuenta. Cierra sesion, vuelve a entrar con Google y repite la accion.'
        showToast(message, 'error')
        throw new Error(message)
      }
      reportCloudError(error, 'No se pudo destruir la boveda y la cuenta.')
      throw error
    }
  }, [listProfiles, reportCloudError, showToast])

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
      localCategories,
      profiles,
      currentProfileId,
      currentProfileName,
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
      saveLocalCategory,
      exportBackup,
      verifyCurrentMasterPassword,
      changeCurrentMasterPassword,
      importBackup,
      importMassiveAccounts,
      cloudUserEmail,
      cloudSyncStatus,
      isInMemory,
      cloudVaultExists,
      hasUnsyncedChanges,
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
      biometricAvailable,
      biometricRegistered,
      registerBiometricUnlock,
      unlockWithBiometricSensor,
      disableBiometricUnlock,
    }),
    [
      addIdentity,
      addPlatform,
      cloudSyncStatus,
      cloudUserEmail,
      cloudVaultExists,
      isInMemory,
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
      localCategories,
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
      saveLocalCategory,
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

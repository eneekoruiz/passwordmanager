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
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  sendPasswordResetEmail,
  type Auth,
  type User,
} from 'firebase/auth'
import { deleteDoc, doc, getDoc, setDoc, type Firestore } from 'firebase/firestore'
import { CryptoVault } from '../crypto/CryptoVault'
import {
  auth,
  db,
  firebaseConfigError,
  resetFirebaseAuthSession,
} from '../services/firebase'
import { VaultStore } from '../storage/VaultStore'
import { deleteVaultDb, isInMemoryFallbackActive, getVaultDb } from '../storage/vaultDb'
import type { Identity, LocalCategory, LocalVaultItem, Platform } from '../types'
import {
  FIREBASE_AUTH_RECOVERY_MESSAGE,
  getFriendlyErrorMessage,
  isRecoverableFirebaseAuthError,
  logUnexpectedError,
} from '../utils/errors'
import { createIdentity, identityMatchesEmail, LOCAL_IDENTITY_EMAIL } from '../utils/identity'
import { normalizeLocalCategory, normalizeLocalVaultItem } from '../utils/vaultItem'
import { useToast } from '../components/ui/ToastProvider'
import { payloadsAreIdentical } from '../utils/hash'
import {
  isBiometricAvailable,
  isMissingBiometricCredentialError,
  registerBiometricCredential,
  unlockWithBiometrics,
  type BiometricBundle,
} from '../crypto/biometric'
import {
  isHardwareKeyAvailable,
  registerHardwareKeyCredential,
  unlockWithHardwareKey,
  type HardwareKeyBundle,
} from '../crypto'

interface VaultContextValue {
  isReady: boolean
  isInitialized: boolean
  isUnlocked: boolean
  isVaultLoaded: boolean
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
  trackItemAccess: (itemId: string, identityId?: string) => Promise<void>
  exportBackup: (masterPassword: string) => Promise<string>
  getAsymmetricPrivateKey: () => Promise<string | undefined>
  verifyCurrentMasterPassword: (masterPassword: string) => Promise<boolean>
  changeCurrentMasterPassword: (currentPassword: string, nextPassword: string, recoveryPhrase: string) => Promise<void>
  importBackup: (backupJsonString: string, masterPassword: string) => Promise<void>
  importMassiveAccounts: (parsedRows: Array<{ identityEmail: string; platform: Platform }>) => Promise<string | null>
  cloudUserEmail: string | null
  cloudUserId: string | null
  cloudSyncStatus: 'checking_storage' | 'idle' | 'syncing' | 'synced' | 'error'
  isInMemory: boolean
  cloudVaultExists: boolean | null
  hasUnsyncedChanges: boolean
  loginWithGoogleCloud: () => Promise<void>
  loginWithEmailAndPassword: (email: string, password: string) => Promise<void>
  registerWithEmailAndPassword: (email: string, password: string) => Promise<void>
  sendCloudPasswordResetEmail: (email: string) => Promise<void>
  logoutCloud: () => Promise<void>
  syncActiveProfileToCloud: (silent?: boolean) => Promise<CloudSyncResult>
  downloadLatestCloudVault: (resolutions?: Record<string, 'local' | 'cloud'>) => Promise<CloudSyncResult>
  restoreProfileFromCloud: (email: string, password: string, masterPassword: string) => Promise<void>
  restoreProfileFromGoogleCloud: (masterPassword: string) => Promise<void>
  initializeNewVault: (masterPassword: string, recoveryPhrase: string) => Promise<void>
  unlockOrRestoreVault: (masterPassword: string) => Promise<void>
  recoverVaultWithSeed: (recoveryPhrase: string, newMasterPassword: string) => Promise<void>
  nukeAccount: () => Promise<void>
  // Biometric unlock
  biometricAvailable: boolean
  biometricRegistered: boolean
  registerBiometricUnlock: (masterPassword: string) => Promise<void>
  unlockWithBiometricSensor: () => Promise<void>
  authorizeSensitiveAction: (actionName?: string) => Promise<boolean>
  isPromptingMasterPassword: boolean
  resolveMasterPasswordPrompt: (success: boolean) => void
  disableBiometricUnlock: () => Promise<void>
  // Hardware key unlock
  hardwareKeyAvailable: boolean
  hardwareKeyRegistered: boolean
  registerHardwareKeyUnlock: (masterPassword: string) => Promise<void>
  unlockWithHardwareKeySensor: () => Promise<void>
  disableHardwareKeyUnlock: () => Promise<void>
  masterKey: CryptoKey | null
  mutationCount: number
  isScanningExposed: boolean
  exposedScanProgress: number
  exposedScanTotal: number
  runExposedPasswordsScan: () => Promise<void>
}

export interface CloudSyncResult {
  action: 'idle' | 'uploaded' | 'downloaded' | 'download_available' | 'synced'
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
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function firebaseErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: string }).code)
    : ''
}

function isAppleMobileAuthContext(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const userAgent = navigator.userAgent
  const isAppleMobile = /iPad|iPhone|iPod/.test(userAgent)
  const isWebKit = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS/.test(userAgent)
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return isAppleMobile || isWebKit || isStandalone
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const vaultRef = useRef(new CryptoVault())
  const storeRef = useRef(new VaultStore(vaultRef.current))
  const firebaseUserRef = useRef<User | null>(null)
  const syncInProgressRef = useRef(false)
  const lastAuthorizedTimeRef = useRef<number>(0)

  const [mutationCount, setMutationCount] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isVaultLoaded, setIsVaultLoaded] = useState(false)
  const [identities, setIdentities] = useState<Identity[]>([])
  const [localItems, setLocalItems] = useState<LocalVaultItem[]>([])
  const [localCategories, setLocalCategories] = useState<LocalCategory[]>([])

  const [isScanningExposed, setIsScanningExposed] = useState(false)
  const [exposedScanProgress, setExposedScanProgress] = useState(0)
  const [exposedScanTotal, setExposedScanTotal] = useState(0)

  const identitiesRef = useRef<Identity[]>([])
  useEffect(() => {
    identitiesRef.current = identities
  }, [identities])

  const [isPromptingMasterPassword, setIsPromptingMasterPassword] = useState(false)
  const masterPasswordResolver = useRef<((success: boolean) => void) | null>(null)
  const masterPasswordPromptPromise = useRef<Promise<boolean> | null>(null)

  const promptMasterPassword = useCallback(() => {
    if (masterPasswordPromptPromise.current) return masterPasswordPromptPromise.current

    const promptPromise = new Promise<boolean>((resolve) => {
      setIsPromptingMasterPassword(true)
      masterPasswordResolver.current = resolve
    })
    masterPasswordPromptPromise.current = promptPromise
    return promptPromise
  }, [])

  const resolveMasterPasswordPrompt = useCallback((success: boolean) => {
    setIsPromptingMasterPassword(false)
    masterPasswordPromptPromise.current = null
    if (masterPasswordResolver.current) {
      masterPasswordResolver.current(success)
      masterPasswordResolver.current = null
    }
  }, [])

  const [profiles, setProfiles] = useState<{ id: string; name: string; createdAt: string }[]>([])
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null)
  const [currentProfileName, setCurrentProfileName] = useState<string | null>(null)
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null)
  const [cloudUserId, setCloudUserId] = useState<string | null>(null)
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'checking_storage' | 'idle' | 'syncing' | 'synced' | 'error'>('checking_storage')
  const [isInMemory, setIsInMemory] = useState(isInMemoryFallbackActive())
  const [cloudVaultExists, setCloudVaultExists] = useState<boolean | null>(null)
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('contras.biometricAvailable') === 'true' : false)
  const [biometricRegistered, setBiometricRegistered] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('contras.biometricRegistered.default') === 'true'
  })
  const [hardwareKeyAvailable, setHardwareKeyAvailable] = useState(false)
  const [hardwareKeyRegistered, setHardwareKeyRegistered] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('contras.hardwareKeyRegistered.default') === 'true'
  })

  // Biometric fallback abort controller
  const [biometricFallbackAbort, setBiometricFallbackAbort] = useState<(() => void) | null>(null)

  const { showToast } = useToast()

  // Check biometric & hardware key availability on mount
  useEffect(() => {
    void isBiometricAvailable()
      .then((available) => {
        setBiometricAvailable(available)
        if (typeof window !== 'undefined') localStorage.setItem('contras.biometricAvailable', available ? 'true' : 'false')
      })
      .catch(() => {
        setBiometricAvailable(false)
        if (typeof window !== 'undefined') localStorage.setItem('contras.biometricAvailable', 'false')
      })
    void isHardwareKeyAvailable()
      .then((available) => setHardwareKeyAvailable(available))
      .catch(() => setHardwareKeyAvailable(false))
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
      setIsVaultLoaded(true)
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
    setIsVaultLoaded(true)
  }, [])

  useEffect(() => {
    let mounted = true
    void Promise.all([
      listProfiles(),
      storeRef.current.hasBiometricBundle('default').then((registered) => {
        if (!mounted) return
        setBiometricRegistered(registered)
        if (registered) {
          localStorage.setItem('contras.biometricRegistered.default', 'true')
        } else {
          if (localStorage.getItem('contras.biometricRegistered.default') === 'true') {
            console.warn('Degraded memory detected: Biometric bundle lost. Resetting prompt status.')
            localStorage.removeItem('contras.biometricRegistered.default')
            localStorage.removeItem('contras.biometricPromptDismissed.v3.default')
            localStorage.removeItem('contras.biometricPromptEnabled')
          }
        }
      }),
      storeRef.current.hasHardwareKeyBundle('default').then((registered) => {
        if (!mounted) return
        setHardwareKeyRegistered(registered)
        if (registered) localStorage.setItem('contras.hardwareKeyRegistered.default', 'true')
      }),
    ]).finally(() => {
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

    const authClient = auth
    const dbClient = db
    let active = true

    const resolveCloudVaultPresence = async (user: User) => {
      try {
        const snapshot = await withTimeout(
          getDoc(doc(dbClient, 'vaults', user.uid)),
          10_000,
          'La consulta de la bóveda en Google Cloud superó el tiempo límite.',
        )
        if (active && firebaseUserRef.current?.uid === user.uid) {
          setCloudVaultExists(Boolean(snapshot.exists() && snapshot.data()?.encrypted_vault_blob))
        }
      } catch (error) {
        logUnexpectedError('Error al comprobar existencia de la boveda', error)
        if (active && firebaseUserRef.current?.uid === user.uid) {
          const localProfiles = await storeRef.current.listProfiles().catch(() => [])
          const hasLocalVault = localProfiles.some((profile) => profile.id === 'default')
          setCloudVaultExists(hasLocalVault ? true : null)
          if (!hasLocalVault) {
            await signOut(authClient).catch(() => undefined)
            firebaseUserRef.current = null
            setCloudUserEmail(null)
          }
          reportCloudError(error, 'No se pudo comprobar la bóveda en Google Cloud. Revisa la conexión y reintenta.')
        }
      }
    }

    const authReadyTimer = window.setTimeout(() => {
      if (!active) return
      setIsAuthReady(true)
      reportCloudError(
        new Error('Firebase Auth no respondió a tiempo.'),
        'La autenticación está tardando demasiado. Reintenta sin recargar la aplicación.',
      )
    }, 10_000)


    const unsubscribe = onAuthStateChanged(authClient, (user) => {
      window.clearTimeout(authReadyTimer)
      if (!active) return

      firebaseUserRef.current = user
      setCloudUserEmail(user?.email ?? null)
      setCloudUserId(user?.uid ?? null)
      setIsAuthReady(true)

      if (!user) {
        setCloudVaultExists(null)
        return
      }

      void resolveCloudVaultPresence(user)
    })

    return () => {
      active = false
      window.clearTimeout(authReadyTimer)
      unsubscribe()
    }
  }, [reportCloudError])

  const logoutProfile = useCallback(() => {
    vaultRef.current.lock()
    setIsUnlocked(false)
    setCurrentProfileId(null)
    setCurrentProfileName(null)
    setIdentities([])
    setLocalItems([])
    setLocalCategories([])
    setIsVaultLoaded(false)
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



  const downloadLatestCloudVault = useCallback(async (resolutions?: Record<string, 'local' | 'cloud'>): Promise<CloudSyncResult> => {
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

      if (resolutions && Object.keys(resolutions).length > 0) {
        // Resolve conflicts manually item-by-item (LWW & User choices)
        const decryptedCloud = await storeRef.current.inspectAndDecryptCloudPayload(cloudBlob)
        const localIdns = await storeRef.current.loadAllIdentities(currentProfileId)

        // Match identities by email
        const mergedIdns = [...decryptedCloud.identities]
        let localWinsExist = false

        for (const localIdn of localIdns) {
          const index = mergedIdns.findIndex(i => i.id === localIdn.id)
          if (index >= 0) {
            const resolution = resolutions?.[localIdn.id]
            if (resolution === 'local') {
              mergedIdns[index] = localIdn
              localWinsExist = true
            } else if (resolution !== 'cloud') {
              const localDate = new Date(localIdn.updatedAt || 0).getTime()
              const cloudDate = new Date(mergedIdns[index].updatedAt || 0).getTime()
              if (localDate > cloudDate) {
                mergedIdns[index] = localIdn
                localWinsExist = true
              }
            }
          } else {
            mergedIdns.push(localIdn)
            localWinsExist = true
          }
        }

        const localItemsDb = await storeRef.current.loadLocalItems(currentProfileId)
        const localCatsDb = await storeRef.current.loadLocalCategories(currentProfileId)

        const mergedLocalItems = [...(decryptedCloud.localItems || [])]
        for (const localItem of localItemsDb) {
          const index = mergedLocalItems.findIndex(i => i.id === localItem.id)
          if (index >= 0) {
            const resolution = resolutions?.[localItem.id]
            if (resolution === 'local') {
              mergedLocalItems[index] = localItem
              localWinsExist = true
            } else if (resolution !== 'cloud') {
              const localDate = new Date(localItem.updatedAt || 0).getTime()
              const cloudDate = new Date(mergedLocalItems[index].updatedAt || 0).getTime()
              if (localDate > cloudDate) {
                mergedLocalItems[index] = localItem
                localWinsExist = true
              }
            }
          } else {
            mergedLocalItems.push(localItem)
            localWinsExist = true
          }
        }

        const mergedCats = [...(decryptedCloud.localCategories || [])]
        for (const localCat of localCatsDb) {
          const index = mergedCats.findIndex(i => i.id === localCat.id)
          if (index >= 0) {
            const resolution = resolutions?.[localCat.id]
            if (resolution === 'local') {
              mergedCats[index] = localCat
              localWinsExist = true
            } else if (resolution !== 'cloud') {
              const localDate = new Date(localCat.updatedAt || 0).getTime()
              const cloudDate = new Date(mergedCats[index].updatedAt || 0).getTime()
              if (localDate > cloudDate) {
                mergedCats[index] = localCat
                localWinsExist = true
              }
            }
          } else {
            mergedCats.push(localCat)
            localWinsExist = true
          }
        }

        // Rebuild/Restore using solved items
        const db = await getVaultDb()
        const tx = db.transaction(['platforms'], 'readwrite')
        const platformsStore = tx.objectStore('platforms')

        // Clear old profile platforms
        const allKeys = await platformsStore.getAllKeys()
        const prefix = `${currentProfileId}_`
        for (const key of allKeys) {
          if (key.startsWith(prefix)) {
            await platformsStore.delete(key)
          }
        }

        // Put all resolved/merged identities
        for (const idn of mergedIdns) {
          const encrypted = await vaultRef.current.encryptJson(idn)
          await platformsStore.put(encrypted, `${currentProfileId}_${idn.id}`)
        }
        for (const item of mergedLocalItems) {
          const encrypted = await vaultRef.current.encryptJson(item)
          await platformsStore.put(encrypted, `${currentProfileId}_item_${item.id}`)
        }
        for (const cat of mergedCats) {
          const encrypted = await vaultRef.current.encryptJson(cat)
          await platformsStore.put(encrypted, `${currentProfileId}_cat_${cat.id}`)
        }
        await tx.done

        await refreshVaultData()

        // If local version won some conflicts, upload the final resolved payload to Google Cloud to prevent data loss
        if (localWinsExist) {
          try {
            const newEncryptedBlob = await storeRef.current.exportCloudPayload(currentProfileId)
            await withTimeout(
              setDoc(vaultRefDoc, {
                encrypted_vault_blob: newEncryptedBlob,
                updated_at: new Date().toISOString(),
              }),
              10000,
              'Error al subir bóveda resuelta a Google Cloud.'
            )
          } catch (uploadErr) {
            console.error('Failed to upload resolved payload', uploadErr)
          }
        }
      } else {
        // Standard restore
        await storeRef.current.restoreCloudPayloadWithActiveSession(currentProfileId, cloudBlob)
      }

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

    if (!isVaultLoaded) {
      return { action: 'idle', message: 'Esperando a que se cargue la bóveda...' }
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
          return { action: 'synced', message: 'Bóveda al día. No hay cambios pendientes.' }
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

          const filterIdentities = (idns: any[]) => {
            return (idns || [])
              .map((idn) => ({
                ...idn,
                platforms: (idn.platforms || []).filter((p: any) => p && !p.isLocalOnly)
              }))
              .filter((idn) => idn.platforms.length > 0)
          }

          const filteredLocalIdns = filterIdentities(localIdns)
          const filteredCloudIdns = filterIdentities(decryptedCloud.identities)

          let computeSyncDiff: any
          try {
            const module = await import('../utils/syncDiff')
            computeSyncDiff = module.computeSyncDiff
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err ?? '')
            const isChunkError =
              /failed to fetch/i.test(message) ||
              /dynamically imported module/i.test(message) ||
              /chunkloaderror/i.test(message) ||
              /loading chunk/i.test(message)

            if (isChunkError && typeof window !== 'undefined') {
              console.warn('Chunk load error detected during syncDiff import. Reloading page...', err)
              window.location.reload()
              return new Promise<any>(() => {}) // Wait indefinitely for reload
            }
            throw err
          }

          const localItemsDb = await storeRef.current.loadLocalItems(currentProfileId)
          const localCatsDb = await storeRef.current.loadLocalCategories(currentProfileId)

          const diffResult = computeSyncDiff(
            filteredLocalIdns, localItemsDb, localCatsDb,
            filteredCloudIdns, decryptedCloud.localItems || [], decryptedCloud.localCategories || []
          )

          if (!diffResult.hasChanges) {
            setCloudVaultExists(true)
            setHasUnsyncedChanges(false)
            setCloudSyncStatus('synced')
            return {
              action: 'synced',
              message: 'Bóveda al día. No hay cambios pendientes.',
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
            }
          }

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

        // Fase 2: Compartición segura (Subir Llave Pública y Directorio)
        const publicKey = await storeRef.current.getAsymmetricPublicKey(currentProfileId)
        if (publicKey && user.email) {
          const { hashEmailForDirectory } = await import('../utils/security')
          const emailHash = await hashEmailForDirectory(user.email)
          
          await setDoc(doc(dbClient, 'publicKeys', user.uid), {
            publicKey,
            updatedAt: new Date().toISOString()
          })
          
          await setDoc(doc(dbClient, 'directory', emailHash), {
            uid: user.uid,
            updatedAt: new Date().toISOString()
          })
        }

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
        reportCloudError(error, 'No se pudo sincronizar la bóveda con Firebase.')
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
    }

    const user = firebaseUserRef.current
    if (user && currentProfileId) {
      // Both user logged in and profile unlocked.
      // Trigger auto-sync with retries!
      setCloudSyncStatus('syncing')
      
      const bootSyncWithRetries = async (attempt = 1) => {
        try {
          const result = await syncActiveProfileToCloud(true) // silent=true
          if (result.action === 'downloaded' || result.action === 'uploaded' || result.action === 'synced') {
            setCloudSyncStatus('synced')
          } else if (result.action === 'download_available') {
            // There are pending changes (either from cloud or local).
            // We now auto-merge them using Last-Write-Wins and pull the data silently.
            await downloadLatestCloudVault()
            // After downloading/merging, trigger a silent push to upload the merged result back to cloud
            void syncActiveProfileToCloud(true)
          } else if (result.action === 'idle') {
            setCloudSyncStatus('idle')
          }
        } catch (err) {
          if (attempt <= 3) {
            console.warn(`Boot sync failed (attempt ${attempt}/3). Retrying in ${attempt * 2}s...`, err)
            setTimeout(() => bootSyncWithRetries(attempt + 1), attempt * 2000)
          } else {
            logUnexpectedError('Auto sync failed completely after retries at boot', err)
            setCloudSyncStatus('error')
          }
        }
      }
      
      void bootSyncWithRetries()
    } else {
      // Not logged in or profile not unlocked yet
      setCloudSyncStatus('idle')
    }
  }, [isReady, isAuthReady, currentProfileId, cloudUserEmail, syncActiveProfileToCloud, downloadLatestCloudVault])

  const triggerCloudSync = useCallback(() => {
    setHasUnsyncedChanges(true)
    setMutationCount(p => p + 1)
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

  const trackItemAccess = useCallback(
    async (itemId: string, identityId?: string) => {
      if (!currentProfileId) return

      try {
        const accessedAt = new Date().toISOString()
        if (identityId) {
          // Es una plataforma dentro de una identidad
          const identity = identities.find(i => i.id === identityId)
          if (identity) {
            const platform = identity.platforms.find(p => p.id === itemId)
            if (platform) {
              const updatedPlatform = {
                ...platform,
                accessCount: (platform.accessCount || 0) + 1,
                lastAccessedAt: accessedAt
              }
              const updatedIdentity = {
                ...identity,
                updatedAt: accessedAt,
                platforms: identity.platforms.map(p => p.id === itemId ? updatedPlatform : p)
              }
              await storeRef.current.saveIdentity(currentProfileId, updatedIdentity)
            }
          }
        } else {
          // Es un item local
          const localItem = localItems.find(i => i.id === itemId)
          if (localItem) {
            const updatedItem = {
              ...localItem,
              accessCount: (localItem.accessCount || 0) + 1,
              lastAccessedAt: accessedAt
            }
            await storeRef.current.saveLocalItem(currentProfileId, updatedItem)
          }
        }
        await refreshVaultData()
        void syncActiveProfileToCloud(true)
      } catch (error) {
        console.warn('Failed to track item access:', error)
      }
    },
    [currentProfileId, identities, localItems, refreshVaultData, syncActiveProfileToCloud],
  )

  const loginWithGoogleCloud = useCallback((): Promise<void> => {
    const { authClient, dbClient } = getFirebaseClients()
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })

    // Force persistence before popup
    return setPersistence(authClient, browserLocalPersistence)
      .then(() => signInWithPopup(authClient, provider))
      .then(async (credential) => {
        firebaseUserRef.current = credential.user
        setCloudSyncStatus('syncing')
        setCloudUserEmail(credential.user.email ?? 'Usuario Google')

        try {
          const snapshot = await withTimeout(
            getDoc(doc(dbClient, 'vaults', credential.user.uid)),
            10_000,
            'Google inició la sesión, pero la comprobación de la bóveda superó el tiempo límite.',
          )
          setCloudVaultExists(Boolean(snapshot.exists() && snapshot.data()?.encrypted_vault_blob))
          setCloudSyncStatus('idle')
        } catch (cloudError) {
          setCloudSyncStatus('error')
          throw cloudError
        }
      })
      .catch(async (authError: unknown) => {
        const code = firebaseErrorCode(authError)

        if (isRecoverableFirebaseAuthError(authError)) {
          await resetFirebaseAuthSession(authClient)
          firebaseUserRef.current = null
          setCloudUserEmail(null)
          setCloudVaultExists(null)
          setCloudSyncStatus('idle')
          throw new Error(FIREBASE_AUTH_RECOVERY_MESSAGE)
        }

        setCloudSyncStatus('idle')

        if (code === 'auth/popup-closed-by-user') {
          throw new Error('El inicio de sesión se cerró antes de completarse.')
        }

        if (code === 'auth/popup-blocked') {
          const mobileHint = isAppleMobileAuthContext()
            ? ' En iPhone/iPad, abre la app en Safari y permite ventanas emergentes para este sitio.'
            : ' Permite ventanas emergentes e inténtalo de nuevo.'
          throw new Error('El navegador bloqueó la ventana de Google.' + mobileHint)
        }

        throw authError
      })
  }, [])

  const loginWithEmailAndPassword = useCallback(
    async (email: string, password: string): Promise<void> => {
      const { authClient, dbClient } = getFirebaseClients()
      setCloudSyncStatus('syncing')
      try {
        await setPersistence(authClient, browserLocalPersistence)
        const credential = await signInWithEmailAndPassword(authClient, email, password)
        firebaseUserRef.current = credential.user
        setCloudUserEmail(credential.user.email ?? email)

        try {
          const snapshot = await withTimeout(
            getDoc(doc(dbClient, 'vaults', credential.user.uid)),
            10_000,
            'Se inició la sesión, pero la comprobación de la bóveda superó el tiempo límite.',
          )
          setCloudVaultExists(Boolean(snapshot.exists() && snapshot.data()?.encrypted_vault_blob))
          setCloudSyncStatus('idle')
        } catch (cloudError) {
          setCloudSyncStatus('error')
          throw cloudError
        }
      } catch (authError: unknown) {
        setCloudSyncStatus('error')
        throw authError
      }
    },
    [],
  )

  const registerWithEmailAndPassword = useCallback(
    async (email: string, password: string): Promise<void> => {
      const { authClient } = getFirebaseClients()
      setCloudSyncStatus('syncing')
      try {
        await setPersistence(authClient, browserLocalPersistence)
        const credential = await createUserWithEmailAndPassword(authClient, email, password)
        firebaseUserRef.current = credential.user
        setCloudUserEmail(credential.user.email ?? email)
        setCloudVaultExists(false)
        setCloudSyncStatus('idle')
      } catch (authError: unknown) {
        setCloudSyncStatus('error')
        throw authError
      }
    },
    [],
  )

  const sendCloudPasswordResetEmail = useCallback(
    async (email: string): Promise<void> => {
      const { authClient } = getFirebaseClients()
      await sendPasswordResetEmail(authClient, email)
    },
    [],
  )

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

  const restoreProfileFromCloud = useCallback(
    async (email: string, password: string, masterPassword: string) => {
      const { authClient, dbClient } = getFirebaseClients()
      setCloudSyncStatus('syncing')
      try {
        let user = firebaseUserRef.current
        if (!user || user.email !== email) {
          const credential = await signInWithEmailAndPassword(authClient, email, password)
          user = credential.user
          firebaseUserRef.current = user
          setCloudUserEmail(user.email ?? email)
        }

        const snapshot = await getDoc(doc(dbClient, 'vaults', user.uid))
        const blob = snapshot.data()?.encrypted_vault_blob as string | undefined
        if (!snapshot.exists() || !blob) throw new Error('No se encontró una bóveda válida en la nube.')
        await restoreIntoDefaultProfile(blob, masterPassword, 'Bóveda Restaurada')
      } catch (error) {
        setCloudSyncStatus('error')
        reportCloudError(error, 'No se pudo restaurar la bóveda.')
        throw error
      }
    },
    [reportCloudError, restoreIntoDefaultProfile],
  )

  const restoreProfileFromGoogleCloud = useCallback(
    async (masterPassword: string) => {
      setCloudSyncStatus('syncing')
      try {
        const { dbClient } = getFirebaseClients()
        const user = firebaseUserRef.current
        if (!user) throw new Error('Primero inicia sesión con Google para conectar tu bóveda en la nube.')

        const snapshot = await getDoc(doc(dbClient, 'vaults', user.uid))
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

        // Fase 2: Compartición segura (Subir Llave Pública y Directorio)
        const publicKey = await storeRef.current.getAsymmetricPublicKey(profileId)
        if (publicKey && user.email) {
          const { hashEmailForDirectory } = await import('../utils/security')
          const emailHash = await hashEmailForDirectory(user.email)
          
          await setDoc(doc(dbClient, 'publicKeys', user.uid), {
            publicKey,
            updatedAt: new Date().toISOString()
          })
          
          await setDoc(doc(dbClient, 'directory', emailHash), {
            uid: user.uid,
            updatedAt: new Date().toISOString()
          })
        }

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
          void storeRef.current.hasBiometricBundle(profileId).then((hasBundle) => {
            setBiometricRegistered(hasBundle)
            if (hasBundle) {
              localStorage.setItem(`contras.biometricRegistered.${profileId}`, 'true')
            } else {
              if (localStorage.getItem(`contras.biometricRegistered.${profileId}`) === 'true') {
                console.warn(`Degraded memory detected for profile ${profileId}. Resetting prompt status.`)
                window.localStorage.removeItem(`contras.biometricPromptDismissed.v3.${profileId}`)
                localStorage.removeItem('contras.biometricPromptEnabled')
              }
              localStorage.removeItem(`contras.biometricRegistered.${profileId}`)
            }
          })
          void storeRef.current.hasHardwareKeyBundle(profileId).then((hasBundle) => {
            setHardwareKeyRegistered(hasBundle)
            if (hasBundle) localStorage.setItem(`contras.hardwareKeyRegistered.${profileId}`, 'true')
            else localStorage.removeItem(`contras.hardwareKeyRegistered.${profileId}`)
          })
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

  const registerBiometricUnlock = useCallback(async (masterPassword: string) => {
    if (!currentProfileId || !cloudUserEmail) throw new Error('No hay un perfil activo.')
    if (!masterPassword) throw new Error('Introduce tu Contraseña Maestra.')
    const passwordIsValid = await storeRef.current.unlockProfile(currentProfileId, masterPassword)
    if (!passwordIsValid) throw new Error('La Contraseña Maestra no es correcta.')

    const existingBundle = await storeRef.current.loadBiometricBundle(currentProfileId)
    const bundle = await registerBiometricCredential(
      masterPassword,
      currentProfileId,
      cloudUserEmail,
      existingBundle?.credentialId,
    )
    await storeRef.current.saveBiometricBundle(bundle)
    localStorage.setItem(`contras.biometricRegistered.${currentProfileId}`, 'true')
    localStorage.setItem(`contras.biometricBundleBackup.${currentProfileId}`, JSON.stringify(bundle))
    setBiometricRegistered(true)
  }, [currentProfileId, cloudUserEmail])

  const unlockWithBiometricSensor = useCallback(async () => {
    const profileId = currentProfileId || 'default'
    let bundle = await storeRef.current.loadBiometricBundle(profileId)
    
    if (!bundle) {
      const backupStr = localStorage.getItem(`contras.biometricBundleBackup.${profileId}`)
      if (backupStr) {
        try {
          bundle = JSON.parse(backupStr)
          await storeRef.current.saveBiometricBundle(bundle as BiometricBundle)
        } catch (e) {}
      }
    }

    if (!bundle) {
      localStorage.removeItem(`contras.biometricRegistered.${profileId}`)
      localStorage.removeItem(`contras.biometricBundleBackup.${profileId}`)
      localStorage.removeItem(`contras.biometricPromptDismissed.v3.${profileId}`)
      setBiometricRegistered(false)
      throw new Error('No hay una llave de acceso local registrada para esta bóveda.')
    }

    try {
      const abortController = new AbortController()
      const timeoutMs = 15000
      let timeoutId: any
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          abortController.abort(new Error('biometric_timeout'))
          reject(new Error('biometric_timeout'))
        }, timeoutMs)
      })

      const masterPassword = await Promise.race([
        unlockWithBiometrics(bundle as BiometricBundle, abortController.signal),
        timeoutPromise
      ])
      clearTimeout(timeoutId)
      await unlockOrRestoreVault(masterPassword)
    } catch (error) {
      if (isMissingBiometricCredentialError(error)) {
        await storeRef.current.deleteBiometricBundle(profileId)
        localStorage.removeItem(`contras.biometricRegistered.${profileId}`)
        localStorage.removeItem(`contras.biometricBundleBackup.${profileId}`)
        localStorage.removeItem(`contras.biometricPromptDismissed.v3.${profileId}`)
        localStorage.removeItem('contras.biometricPromptEnabled')
        setBiometricRegistered(false)
        throw new Error('El dispositivo ya no encuentra la llave de acceso local de Contras. Vuelve a activarla desde Ajustes después de entrar con tu Contraseña Maestra.')
      }
      const errorMessage = error instanceof Error ? error.message : ''
      if (errorMessage === 'biometric_timeout') {
        await storeRef.current.deleteBiometricBundle(profileId)
        localStorage.removeItem(`contras.biometricRegistered.${profileId}`)
        localStorage.removeItem(`contras.biometricBundleBackup.${profileId}`)
        localStorage.removeItem(`contras.biometricPromptDismissed.v3.${profileId}`)
        setBiometricRegistered(false)
        throw new Error('La autenticación biométrica tardó demasiado o fue bloqueada por el navegador. Se ha desactivado temporalmente. Usa tu Contraseña Maestra y vuelve a activarla.')
      }
      if (errorMessage.includes('PRF') || errorMessage.includes('prf')) {
        await storeRef.current.deleteBiometricBundle(profileId)
        localStorage.removeItem(`contras.biometricRegistered.${profileId}`)
        localStorage.removeItem(`contras.biometricBundleBackup.${profileId}`)
        localStorage.removeItem(`contras.biometricPromptDismissed.v3.${profileId}`)
        setBiometricRegistered(false)
        throw new Error('La llave local ya no es compatible con este navegador o dispositivo. Se ha desactivado automáticamente. Entra con tu Contraseña Maestra y vuelve a activarla desde Ajustes si lo deseas.')
      }
      throw error
    }
  }, [currentProfileId, unlockOrRestoreVault])

  const registerHardwareKeyUnlock = useCallback(async (masterPassword: string) => {
    if (!currentProfileId || !cloudUserEmail) throw new Error('No hay un perfil activo.')
    if (!masterPassword) throw new Error('Introduce tu Contraseña Maestra.')
    const passwordIsValid = await storeRef.current.unlockProfile(currentProfileId, masterPassword)
    if (!passwordIsValid) throw new Error('La Contraseña Maestra no es correcta.')

    const bundle = await registerHardwareKeyCredential(
      masterPassword,
      currentProfileId,
      cloudUserEmail,
    )
    await storeRef.current.saveHardwareKeyBundle(bundle)
    localStorage.setItem(`contras.hardwareKeyRegistered.${currentProfileId}`, 'true')
    setHardwareKeyRegistered(true)
  }, [currentProfileId, cloudUserEmail])

  const unlockWithHardwareKeySensor = useCallback(async () => {
    const profileId = 'default'
    const bundle = await storeRef.current.loadHardwareKeyBundle(profileId)
    if (!bundle) throw new Error('No hay llave física registrada.')
    const masterPassword = await unlockWithHardwareKey(bundle as HardwareKeyBundle)
    await unlockOrRestoreVault(masterPassword)
  }, [unlockOrRestoreVault])

  const authorizeSensitiveAction = useCallback(async (_actionName: string = 'Acción protegida') => {
    if (!currentProfileId || !isUnlocked) return false

    const now = Date.now()
    if (now - lastAuthorizedTimeRef.current < 30000) {
      return true
    }
    
    // Si tiene biometría activa, la preferimos – pero solo en móvil/táctil.
    // En desktop (sin touchpoints) ir directamente al modal de contraseña maestra
    // porque Windows Hello / Mac TouchID pueden colgar la UI silenciosamente.
    const isTouchDevice = typeof window !== 'undefined' && navigator.maxTouchPoints > 0
    if (biometricRegistered && isTouchDevice) {
      let bundle = await storeRef.current.loadBiometricBundle(currentProfileId)
      
      if (!bundle) {
        const backupStr = localStorage.getItem(`contras.biometricBundleBackup.${currentProfileId}`)
        if (backupStr) {
          try {
            bundle = JSON.parse(backupStr)
            await storeRef.current.saveBiometricBundle(bundle as BiometricBundle)
          } catch (e) {}
        }
      }

      if (!bundle) {
        localStorage.removeItem(`contras.biometricRegistered.${currentProfileId}`)
        localStorage.removeItem(`contras.biometricBundleBackup.${currentProfileId}`)
        localStorage.removeItem(`contras.biometricPromptDismissed.v3.${currentProfileId}`)
        setBiometricRegistered(false)
        // Continuamos con el fallback
      } else {
        try {
          // Race: si la biometría no responde en 7s, caemos al fallback de contraseña
          const timeoutMs = 7000
          let timeoutId: any
          
          const abortController = new AbortController()

          const biometricTimeout = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              abortController.abort(new Error('biometric_timeout'))
              reject(new Error('biometric_timeout'))
            }, timeoutMs)
          })

          const manualAbort = new Promise<never>((_, reject) => {
            setBiometricFallbackAbort(() => () => {
              clearTimeout(timeoutId)
              abortController.abort(new Error('manual_fallback'))
              reject(new Error('manual_fallback'))
            })
          })

          const masterPassword = await Promise.race([
            unlockWithBiometrics(bundle as BiometricBundle, abortController.signal),
            biometricTimeout,
            manualAbort
          ])
          
          clearTimeout(timeoutId)
          setBiometricFallbackAbort(null)

          const passwordIsValid = await storeRef.current.unlockProfile(currentProfileId, masterPassword)
          if (passwordIsValid) {
            lastAuthorizedTimeRef.current = Date.now()
            return true
          }
          // Si la contraseña no es válida (bundle corrupto), continuamos al fallback
        } catch (err) {
          setBiometricFallbackAbort(null)
          if (isMissingBiometricCredentialError(err)) {
            await storeRef.current.deleteBiometricBundle(currentProfileId)
            localStorage.removeItem(`contras.biometricRegistered.${currentProfileId}`)
            localStorage.removeItem(`contras.biometricBundleBackup.${currentProfileId}`)
            localStorage.removeItem(`contras.biometricPromptDismissed.v3.${currentProfileId}`)
            setBiometricRegistered(false)
          }
          const msg = err instanceof Error ? err.message : ''
          if (msg === 'biometric_timeout') {
            console.warn('Biometría no respondió a tiempo, usando fallback.')
          } else if (msg === 'manual_fallback') {
            console.warn('Usuario saltó la biometría manualmente.')
          } else {
            console.warn('Biometría cancelada o fallida, usando fallback.', err)
          }
          // Siempre continuamos al fallback
        }
      }
    }


    // Si tiene llave física activa, la usamos.
    if (hardwareKeyAvailable && hardwareKeyRegistered) {
      const bundle = await storeRef.current.loadHardwareKeyBundle(currentProfileId)
      if (!bundle) {
        localStorage.removeItem(`contras.hardwareKeyRegistered.${currentProfileId}`)
        setHardwareKeyRegistered(false)
      } else {
        try {
          showToast('Verifica tu llave de seguridad...', 'info')
          const masterPassword = await unlockWithHardwareKey(bundle as HardwareKeyBundle)
          const passwordIsValid = await storeRef.current.unlockProfile(currentProfileId, masterPassword)
          if (passwordIsValid) {
            lastAuthorizedTimeRef.current = Date.now()
            return true
          }
        } catch (err) {
          console.warn('Llave física cancelada o fallida, usando fallback.', err)
        }
      }
    }

    // Fallback: siempre pedimos la clave maestra mediante el modal
    const authorized = await withTimeout(
      promptMasterPassword(),
      120000,
      'La verificación tardó demasiado. Vuelve a intentarlo.',
    ).catch((error) => {
      resolveMasterPasswordPrompt(false)
      throw error
    })
    if (!authorized) {
      showToast('Autorización cancelada.', 'error')
      return false
    }
    lastAuthorizedTimeRef.current = Date.now()
    return true
  }, [biometricAvailable, biometricRegistered, hardwareKeyAvailable, hardwareKeyRegistered, currentProfileId, isUnlocked, promptMasterPassword, resolveMasterPasswordPrompt, showToast])

  const disableBiometricUnlock = useCallback(async () => {
    if (!currentProfileId) return
    await storeRef.current.deleteBiometricBundle(currentProfileId)
    localStorage.removeItem(`contras.biometricRegistered.${currentProfileId}`)
    localStorage.removeItem(`contras.biometricBundleBackup.${currentProfileId}`)
    setBiometricRegistered(false)
  }, [currentProfileId])

  const disableHardwareKeyUnlock = useCallback(async () => {
    if (!currentProfileId) return
    await storeRef.current.deleteHardwareKeyBundle(currentProfileId)
    localStorage.removeItem(`contras.hardwareKeyRegistered.${currentProfileId}`)
    setHardwareKeyRegistered(false)
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

  const runExposedPasswordsScan = useCallback(async () => {
    if (isScanningExposed || !currentProfileId) return
    setIsScanningExposed(true)
    setExposedScanProgress(0)

    try {
      const { checkPasswordBreach } = await import('../utils/security')
      
      const currentIdentities = identitiesRef.current
      
      const allAccounts = currentIdentities.flatMap((identity) =>
        (identity.platforms || []).map((platform) => ({
          identityId: identity.id,
          platform,
          password: platform.accessMethods?.find((m) => m.type === 'PASSWORD')?.password ?? '',
        }))
      )
      
      const validAccounts = allAccounts.filter(acc => acc.password && !acc.platform.ignoreExposedPasswordWarning)
      setExposedScanTotal(validAccounts.length)
      setExposedScanProgress(0)

      const identityUpdatesMap = new Map<string, Identity>()

      for (let i = 0; i < validAccounts.length; i++) {
        const acc = validAccounts[i]
        try {
          const count = await checkPasswordBreach(acc.password)
          const targetId = acc.identityId
          let identityToUpdate = identityUpdatesMap.get(targetId) || currentIdentities.find(id => id.id === targetId)
          
          if (identityToUpdate) {
            const updatedPlatforms = identityToUpdate.platforms.map(p => 
              p.id === acc.platform.id 
                ? { ...p, exposedBreachCount: count, lastExposedCheckAt: new Date().toISOString() } 
                : p
            )
            
            identityUpdatesMap.set(targetId, {
              ...identityToUpdate,
              platforms: updatedPlatforms,
              updatedAt: new Date().toISOString()
            })
          }
        } catch (err) {
          console.error('Error checking password leak in background scan:', err)
        }
        setExposedScanProgress(i + 1)
      }

      for (const [_, updatedIdentity] of identityUpdatesMap.entries()) {
        await storeRef.current.saveIdentity(currentProfileId, updatedIdentity)
      }

      if (identityUpdatesMap.size > 0) {
        await refreshVaultData()
        setHasUnsyncedChanges(true)
        triggerCloudSync()
        showToast('Auditoría de filtraciones en segundo plano completada.', 'success')
      } else {
        showToast('No se encontraron cambios tras la auditoría.', 'info')
      }
    } catch (e) {
      console.error('Exposed scan error:', e)
      showToast('Error al ejecutar la auditoría de filtraciones.', 'error')
    } finally {
      setIsScanningExposed(false)
    }
  }, [currentProfileId, refreshVaultData, triggerCloudSync, showToast, isScanningExposed])

  const exportBackup = useCallback(
    async (masterPassword: string) => {
      if (!currentProfileId) throw new Error('No hay un perfil activo para exportar.')
      return await storeRef.current.exportBackup(currentProfileId, masterPassword)
    },
    [currentProfileId],
  )

  const getAsymmetricPrivateKey = useCallback(
    async () => {
      if (!currentProfileId) throw new Error('No hay un perfil activo para obtener la llave.')
      return await storeRef.current.getAsymmetricPrivateKey(currentProfileId)
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
      isVaultLoaded,
      mutationCount,
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
      trackItemAccess,
      exportBackup,
      getAsymmetricPrivateKey,
      verifyCurrentMasterPassword,
      changeCurrentMasterPassword,
      importBackup,
      importMassiveAccounts,
      cloudUserEmail,
      cloudUserId,
      cloudSyncStatus,
      isInMemory,
      cloudVaultExists,
      hasUnsyncedChanges,
      loginWithGoogleCloud,
      loginWithEmailAndPassword,
      registerWithEmailAndPassword,
      sendCloudPasswordResetEmail,
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
      authorizeSensitiveAction,
      disableBiometricUnlock,
      hardwareKeyAvailable,
      hardwareKeyRegistered,
      registerHardwareKeyUnlock,
      unlockWithHardwareKeySensor,
      disableHardwareKeyUnlock,
      isPromptingMasterPassword,
      resolveMasterPasswordPrompt,
      masterKey: isUnlocked ? vaultRef.current.masterKey : null,
      isScanningExposed,
      exposedScanProgress,
      exposedScanTotal,
      runExposedPasswordsScan,
    }),
    [
      addIdentity,
      addPlatform,
      cloudSyncStatus,
      cloudUserEmail,
      cloudUserId,
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
      getAsymmetricPrivateKey,
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
      loginWithEmailAndPassword,
      registerWithEmailAndPassword,
      sendCloudPasswordResetEmail,
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
      trackItemAccess,
      selectProfile,
      syncActiveProfileToCloud,
      unlockOrRestoreVault,
      updatePlatform,
      biometricAvailable,
      biometricRegistered,
      registerBiometricUnlock,
      unlockWithBiometricSensor,
      authorizeSensitiveAction,
      disableBiometricUnlock,
      hardwareKeyAvailable,
      hardwareKeyRegistered,
      registerHardwareKeyUnlock,
      unlockWithHardwareKeySensor,
      disableHardwareKeyUnlock,
      isPromptingMasterPassword,
      resolveMasterPasswordPrompt,
      hasUnsyncedChanges,
      mutationCount,
      isScanningExposed,
      exposedScanProgress,
      exposedScanTotal,
      runExposedPasswordsScan,
    ],
  )

  return (
    <VaultContext.Provider value={value}>
      {children}

      {biometricFallbackAbort && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center flex flex-col items-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Verificando Biometría...</h3>
            <p className="text-sm text-slate-500 mb-6">Toca el sensor de huellas o mira a la cámara.</p>
            <button
              onClick={() => biometricFallbackAbort()}
              className="w-full rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Usar contraseña maestra
            </button>
          </div>
        </div>
      )}
    </VaultContext.Provider>
  )
}

export function useVault(): VaultContextValue {
  const context = useContext(VaultContext)
  if (!context) throw new Error('useVault debe usarse dentro de VaultProvider')
  return context
}


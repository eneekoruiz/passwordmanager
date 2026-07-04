/**
 * @module firebase
 * @description Inicialización defensiva del cliente de Firebase.
 *
 * Este módulo exporta las instancias de Firebase Auth y Firestore listas para
 * usar en toda la aplicación. Los valores de las variables de entorno son
 * proporcionados por Vite en tiempo de compilación a través de import.meta.env.
 *
 * Seguridad: Las claves del SDK de Firebase (apiKey, etc.) son claves públicas
 * diseñadas para identificar el proyecto, NO para autorizar acceso. El control
 * de acceso real se aplica mediante las Reglas de Seguridad de Firestore y
 * Firebase Auth, que garantizan que cada usuario solo puede leer/escribir
 * su propio documento de bóveda.
 *
 * Las variables de entorno NUNCA se incluyen en el repositorio de Git gracias
 * al .gitignore. Se configuran directamente en el panel de Vercel para producción.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  initializeAuth,
  browserLocalPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  getAuth,
  setPersistence,
  signOut,
  type Auth,
} from 'firebase/auth'
import { initializeFirestore, memoryLocalCache, getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const configuredAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? ''

function isLocalhostHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function getRuntimeAuthDomain(configuredDomain: string): string {
  if (typeof window === 'undefined' || !configuredDomain) return configuredDomain

  const { protocol, hostname, host } = window.location
  if (protocol !== 'https:' || isLocalhostHost(hostname)) return configuredDomain

  try {
    const configuredUrl = configuredDomain.includes('://')
      ? new URL(configuredDomain)
      : new URL('https://' + configuredDomain)

    if (configuredUrl.hostname === hostname) return configuredDomain

    // Safari ITP rompe el estado temporal de Firebase Auth cuando authDomain
    // vive en firebaseapp.com y la PWA en Vercel/custom domain. En producción
    // usamos el host actual como authDomain y Vercel proxyea /__/auth/* hacia
    // el dominio Firebase original definido en vercel.json.
    if (configuredUrl.hostname.endsWith('.firebaseapp.com')) {
      return host
    }
  } catch {
    return configuredDomain
  }

  return configuredDomain
}

const firebaseEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? '',
  authDomain: getRuntimeAuthDomain(configuredAuthDomain),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() ?? '',
}

const missingEnvKeys = Object.entries({
  VITE_FIREBASE_API_KEY: firebaseEnv.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebaseEnv.authDomain,
  VITE_FIREBASE_PROJECT_ID: firebaseEnv.projectId,
  VITE_FIREBASE_APP_ID: firebaseEnv.appId,
})
  .filter(([, value]) => !value)
  .map(([key]) => key)

export const firebaseConfigError =
  missingEnvKeys.length > 0
    ? `Faltan variables de entorno de Firebase: ${missingEnvKeys.join(', ')}. Configuralas en Vercel antes de desplegar.`
    : null

/** Instancia principal de la aplicación Firebase. */
let app: FirebaseApp | null = null
try {
  if (!firebaseConfigError) {
    app = initializeApp(firebaseEnv)
  }
} catch (error) {
  console.error('Error al inicializar Firebase App de forma síncrona:', error)
}

/**
 * Instancia de Firebase Authentication.
 * Usada para registrar usuarios, iniciar y cerrar sesión,
 * y escuchar cambios en el estado de autenticación.
 *
 * Se inicializa defensivamente: si la persistencia local de navegador
 * es bloqueada (ej. por WebKit/Safari), cae de forma silenciosa a in-memory.
 */
function initAuth(): Auth | null {
  if (!app) return null
  try {
    return initializeAuth(app, {
      persistence: [browserLocalPersistence, inMemoryPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch (error) {
    console.warn('Auth browserLocalPersistence failed, falling back to inMemoryPersistence:', error)
    try {
      return initializeAuth(app, {
        persistence: inMemoryPersistence,
        popupRedirectResolver: browserPopupRedirectResolver,
      })
    } catch (innerErr) {
      console.error('Auth fallback initialization failed completely:', innerErr)
      try {
        return getAuth(app)
      } catch (getAuthErr) {
        console.error('getAuth falló completamente:', getAuthErr)
        return null
      }
    }
  }
}

export const auth: Auth | null = initAuth()

export const firebaseAuthDomain = firebaseEnv.authDomain
export const configuredFirebaseAuthDomain = configuredAuthDomain

export function isFirebaseAuthDomainSameOrigin(): boolean {
  if (typeof window === 'undefined' || !firebaseAuthDomain) return false
  try {
    const authUrl = firebaseAuthDomain.includes('://')
      ? new URL(firebaseAuthDomain)
      : new URL('https://' + firebaseAuthDomain)
    return authUrl.hostname === window.location.hostname
  } catch {
    return false
  }
}

function clearFirebaseRedirectState(): void {
  if (typeof window === 'undefined') return
  try {
    const keys = Array.from({ length: window.sessionStorage.length }, (_, index) =>
      window.sessionStorage.key(index),
    ).filter((key): key is string => Boolean(key?.startsWith('firebase:')))
    keys.forEach((key) => window.sessionStorage.removeItem(key))
  } catch {
    // Safari puede bloquear por completo sessionStorage en PWA/WebView.
  }
}

export async function resetFirebaseAuthSession(authClient: Auth): Promise<void> {
  await signOut(authClient).catch(() => undefined)
  clearFirebaseRedirectState()

  try {
    await setPersistence(authClient, browserLocalPersistence)
  } catch {
    await setPersistence(authClient, inMemoryPersistence).catch(() => undefined)
  }
}

/**
 * Instancia de Cloud Firestore.
 * Usada exclusivamente para leer y escribir el blob de la bóveda
 * cifrada del usuario autenticado en la colección `vaults`.
 *
 * Se inicializa forzando el cache en memoria para evitar que
 * Firebase intente acceder a IndexedDB nativamente si está restringido.
 */
function initFirestore(): Firestore | null {
  if (!app) return null
  try {
    return initializeFirestore(app, {
      localCache: memoryLocalCache(),
    })
  } catch (error) {
    console.warn('Firestore initializeFirestore with memoryLocalCache failed, falling back:', error)
    try {
      return getFirestore(app)
    } catch (innerErr) {
      console.error('Firestore initialization failed completely:', innerErr)
      return null
    }
  }
}

export const db: Firestore | null = initFirestore()

function initStorage(): FirebaseStorage | null {
  if (!app) return null
  try {
    return getStorage(app)
  } catch (error) {
    console.warn('Firebase Storage initialization failed:', error)
    return null
  }
}

export const storage: FirebaseStorage | null = initStorage()

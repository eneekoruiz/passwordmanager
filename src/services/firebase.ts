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
import { initializeAuth, browserLocalPersistence, inMemoryPersistence, browserPopupRedirectResolver, getAuth, type Auth } from 'firebase/auth'
import { initializeFirestore, memoryLocalCache, getFirestore, type Firestore } from 'firebase/firestore'

const firebaseEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? '',
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
const app: FirebaseApp | null = firebaseConfigError ? null : initializeApp(firebaseEnv)

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
      persistence: browserLocalPersistence,
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
      return getAuth(app)
    }
  }
}

export const auth: Auth | null = initAuth()

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

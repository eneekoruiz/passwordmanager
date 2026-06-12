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
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

/** Configuración de Firebase leída de variables de entorno de Vite. */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'placeholder-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'placeholder.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'placeholder-project',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:placeholder',
}

/** Instancia principal de la aplicación Firebase. */
const app: FirebaseApp = initializeApp(firebaseConfig)

/**
 * Instancia de Firebase Authentication.
 * Usada para registrar usuarios, iniciar y cerrar sesión,
 * y escuchar cambios en el estado de autenticación.
 */
export const auth: Auth = getAuth(app)

/**
 * Instancia de Cloud Firestore.
 * Usada exclusivamente para leer y escribir el blob de la bóveda
 * cifrada del usuario autenticado en la colección `vaults`.
 */
export const db: Firestore = getFirestore(app)

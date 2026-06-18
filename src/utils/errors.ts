const FIREBASE_AUTH_MESSAGES: Record<string, string> = {
  'auth/popup-closed-by-user': 'El inicio de sesion se cerro antes de completarse.',
  'auth/popup-blocked': 'El navegador bloqueo la ventana de inicio de sesion. Permite popups e intentalo de nuevo.',
  'auth/network-request-failed': 'No se pudo conectar con Firebase. Revisa tu conexion e intentalo otra vez.',
  'auth/invalid-credential': 'La sesion no pudo validarse. Vuelve a intentarlo.',
  'auth/invalid-login-credentials': 'Las credenciales no son validas.',
  'auth/user-not-found': 'No existe una cuenta asociada a ese usuario.',
  'auth/wrong-password': 'La credencial introducida no es correcta.',
  'auth/too-many-requests': 'Se han detectado demasiados intentos. Espera un momento antes de reintentar.',
  'auth/account-exists-with-different-credential':
    'Esta cuenta ya existe con otro metodo de acceso.',
}

const STORAGE_ERROR_PATTERNS: Array<[RegExp, string]> = [
  [/indexeddb/i, 'La base de datos local no se pudo abrir. Cierra la app y vuelve a intentarlo.'],
  [/idbdatabase/i, 'El almacenamiento local no esta disponible en este navegador o perfil.'],
  [/quota/i, 'El dispositivo no tiene espacio suficiente para guardar cambios locales.'],
  [/decrypt/i, 'Los datos no pudieron descifrarse. Verifica tu contrasena maestra.'],
  [/unexpected token/i, 'El archivo o contenido importado no tiene un formato valido.'],
  [/perfil no encontrado/i, 'La bóveda local no se encontró en este dispositivo. Descarga tus datos desde la nube.'],
]

export function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code?: string }).code)
    if (FIREBASE_AUTH_MESSAGES[code]) {
      return FIREBASE_AUTH_MESSAGES[code]
    }
  }

  if (error instanceof DOMException) {
    if (error.name === 'QuotaExceededError') {
      return 'El almacenamiento local esta lleno y no se pudieron guardar los cambios.'
    }

    if (error.name === 'InvalidStateError') {
      return 'Safari está limitando el almacenamiento temporalmente. La app funciona en modo seguro.'
    }
  }

  if (error instanceof Error) {
    for (const [pattern, message] of STORAGE_ERROR_PATTERNS) {
      if (pattern.test(error.message)) {
        return message
      }
    }

    return error.message || fallback
  }

  return fallback
}

export function logUnexpectedError(scope: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.error(scope, error)
  }
}

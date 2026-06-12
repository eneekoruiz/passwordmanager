export interface ApiKeyEntry {
  id: string
  nombre: string
  descripcion: string
  valor: string
}

/**
 * Cuenta completa dentro de una plataforma.
 * Diseñada para soportar importaciones complejas y campos opcionales extensos.
 */
export interface Account {
  id: string
  /** Nombre de usuario / identificador principal */
  username: string
  email: string
  password: string
  /** Número de teléfono (opcional) */
  phone?: string
  /**
   * Notas libres: fecha de nacimiento, nombre completo, estado 2FA, etc.
   * Texto amplio sin estructura fija para flexibilidad en importaciones.
   */
  notes?: string
  /** Claves API con nombre y valor */
  apiKeys?: ApiKeyEntry[]
  /** Códigos de recuperación en texto plano dentro del blob cifrado */
  recoveryCodes?: string
  createdAt: string
  updatedAt: string
}

/** Plataforma (ej. Facebook) con múltiples cuentas asociadas */
export interface Platform {
  id: string
  name: string
  accounts: Account[]
  createdAt: string
  updatedAt: string
}

/** Estado completo de la bóveda en memoria (nunca persistido en texto plano) */
export interface VaultData {
  platforms: Platform[]
}

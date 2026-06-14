export interface ApiKeyEntry {
  id: string
  nombre: string
  descripcion: string
  valor: string
}

export interface CredentialFields {
  id: string
  username: string
  password: string
  fullName: string | null
  linkedPhone: string | null
  twoFactorAuth: string | null
  /**
   * Correo usado para SSO social. Es metadato sensible y permanece dentro del
   * JSON cifrado AES-256-GCM; Firebase solo recibe el blob opaco.
   */
  linkedGoogleAccount: string | null
  notes?: string
  apiKeys?: ApiKeyEntry[]
  recoveryCodes?: string
  createdAt: string
  updatedAt: string
}

/** Plataforma concreta dentro de una identidad: Amazon, Netflix, GitHub, etc. */
export interface Platform extends CredentialFields {
  id: string
  name: string
}

/**
 * Alias temporal para componentes de credencial existentes.
 * La UI ya edita plataformas como unidad de credencial Identity-First.
 */
export type Account = Platform

/** Identidad de primer nivel, normalmente un correo electronico. */
export interface Identity {
  id: string
  email: string
  platforms: Platform[]
  createdAt: string
  updatedAt: string
}

/** Estado completo de la bóveda en memoria (nunca persistido en texto plano) */
export interface VaultData {
  identities: Identity[]
}

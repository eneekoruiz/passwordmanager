export interface ApiKeyEntry {
  id: string
  nombre: string
  descripcion: string
  valor: string
}

export type VaultItemType = 'ACCOUNT' | 'WIFI' | 'SOFTWARE_LICENSE' | 'FINANCE' | 'SECURE_NOTE'
export type LocalVaultItemType = Exclude<VaultItemType, 'ACCOUNT'>
export type VaultGroupMode = 'identity' | 'platform'
export type AuthMethod = 'PASSWORD' | 'SSO' | 'PASSKEY' | 'MAGIC_LINK'
export type SsoProvider = string
export type TwoFactorType = 'NONE' | 'PIN' | 'TOTP' | 'SMS'
export type WifiSecurityType = 'WPA2' | 'WPA3' | 'WEP' | 'OPEN' | 'OTHER'

export interface TwoFactorConfig {
  type: TwoFactorType
  pin?: string | null
  secret?: string | null
}

export interface PasswordAccessMethod {
  id: string
  type: 'PASSWORD'
  password: string
}

export interface SsoAccessMethod {
  id: string
  type: 'SSO'
  provider: SsoProvider
  email: string | null
}

export interface PasskeyAccessMethod {
  id: string
  type: 'PASSKEY'
}

export interface MagicLinkAccessMethod {
  id: string
  type: 'MAGIC_LINK'
  email: string | null
}

export type AccountAccessMethod =
  | PasswordAccessMethod
  | SsoAccessMethod
  | PasskeyAccessMethod
  | MagicLinkAccessMethod

export interface BaseVaultItem {
  id: string
  type: VaultItemType
  title: string
  createdAt: string
  updatedAt: string
}

export interface AccountVaultItem extends BaseVaultItem {
  type: 'ACCOUNT'
  /** Nombre de plataforma: Amazon, GitHub, Stripe, etc. */
  name: string
  username: string
  accessMethods: AccountAccessMethod[]
  hardwareKey: boolean
  fullName: string | null
  birthDate: string | null
  linkedPhone: string | null
  twoFactorAuth: TwoFactorConfig | string | null
  notes?: string
  apiKeys?: ApiKeyEntry[]
  recoveryCodes?: string
}

/** Plataforma concreta dentro de una identidad: Amazon, Netflix, GitHub, etc. */
export type Platform = AccountVaultItem

/**
 * Alias temporal para componentes de credencial existentes.
 * La UI ya edita plataformas como unidad de credencial Identity-First.
 */
export type Account = Platform

export interface WifiVaultItem extends BaseVaultItem {
  type: 'WIFI'
  ssid: string
  password: string | null
  securityType: WifiSecurityType
}

export interface SoftwareLicenseVaultItem extends BaseVaultItem {
  type: 'SOFTWARE_LICENSE'
  softwareName: string
  licenseKey: string
}

export interface FinanceVaultItem extends BaseVaultItem {
  type: 'FINANCE'
  cardNumber: string
  pin: string | null
  cvv: string | null
  expiry: string | null
}

export interface SecureNoteVaultItem extends BaseVaultItem {
  type: 'SECURE_NOTE'
  markdown: string
}

export type LocalVaultItem =
  | WifiVaultItem
  | SoftwareLicenseVaultItem
  | FinanceVaultItem
  | SecureNoteVaultItem

export type VaultItem = AccountVaultItem | LocalVaultItem

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
  localItems: LocalVaultItem[]
}

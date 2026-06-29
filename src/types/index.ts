export interface ApiKeyEntry {
  id: string
  nombre: string
  descripcion: string
  valor: string
}

export interface FileAttachment {
  id: string
  name: string
  description: string
  fileName: string
  mimeType: string
  size: number
  data: string
  createdAt: string
}

export interface CustomFieldEntry {
  id: string
  key: string
  value: string
  protected?: boolean
  type?: 'text' | 'password' | 'textarea' | 'select'
  options?: string[]
}

export interface PasswordHistoryEntry {
  id: string
  password: string
  changedAt: string
}

export type VaultItemType = 'ACCOUNT' | 'WIFI' | 'SOFTWARE_LICENSE' | 'FINANCE' | 'SECURE_NOTE'
export type LocalVaultItemType = Exclude<VaultItemType, 'ACCOUNT'>
export type VaultGroupMode = 'identity' | 'platform' | 'local'
export type SortMode = 'alpha-asc' | 'alpha-desc' | 'date-desc' | 'date-asc' | 'usage-desc'
export type AuthMethod = 'PASSWORD' | 'SSO' | 'PASSKEY' | 'MAGIC_LINK'
export type SsoProvider = string
export type TwoFactorType = 'NONE' | 'PIN' | 'TOTP' | 'SMS' | 'EMAIL'
export type WifiSecurityType = 'WPA2' | 'WPA3' | 'WEP' | 'OPEN' | 'OTHER'

export interface TwoFactorConfig {
  id: string
  type: TwoFactorType
  pin?: string | null
  secret?: string | null
  authenticatorApp?: string | null
  phone?: string | null
}

export interface PasswordAccessMethod {
  id: string
  type: 'PASSWORD'
  password: string
}

export interface SsoAccessMethod {
  id: string
  type: 'SSO'
  providers: SsoProvider[]
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
  categoryId?: string | null
  categoryLabel?: string | null
  createdAt: string
  updatedAt: string
  isLocalOnly?: boolean
  sensitive?: boolean
  customFields?: CustomFieldEntry[]
}

export type VaultDiffStatus = 'added' | 'modified' | 'deleted' | 'conflict'

export interface VaultDiffItem {
  id: string
  title: string
  subtitle?: string
  type: VaultItemType
  status: VaultDiffStatus
  localUpdatedAt?: string
  cloudUpdatedAt?: string
  localData?: any
  cloudData?: any
}

export interface SyncDiffResult {
  hasChanges: boolean
  diffs: VaultDiffItem[]
  cloudIdentities: any[]
  cloudLocalItems: any[]
}

export interface LocalCategory {
  id: string
  label: string
  type: LocalVaultItemType
  custom?: boolean
  createdAt?: string
  updatedAt?: string
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
  accountCreatedAt: string | null
  linkedPhone: string | null
  twoFactorAuth: TwoFactorConfig | string | null
  twoFactorAuths?: TwoFactorConfig[]
  notes?: string
  apiKeys?: ApiKeyEntry[]
  recoveryCodes?: string
  customFields?: CustomFieldEntry[]
  attachments?: FileAttachment[]
  passwordHistory?: PasswordHistoryEntry[]
  sensitive?: boolean
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


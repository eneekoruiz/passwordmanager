import type { Account, AccountAccessMethod, ApiKeyEntry, TwoFactorConfig } from '../types'

function normalizeAccessMethods(methods: AccountAccessMethod[]): AccountAccessMethod[] {
  return methods
    .map((method) => {
      if (method.type === 'PASSWORD') {
        return { ...method, password: method.password.trim() }
      }
      if (method.type === 'SSO') {
        return { ...method, email: method.email?.trim() || null }
      }
      if (method.type === 'MAGIC_LINK') {
        return { ...method, email: method.email?.trim() || null }
      }
      return method
    })
    .filter((method) => {
      if (method.type === 'PASSWORD') return method.password.length > 0
      return true
    })
}

function normalizeTwoFactor(twoFactorAuth: Account['twoFactorAuth']): TwoFactorConfig | null {
  if (!twoFactorAuth) return null

  if (typeof twoFactorAuth === 'string') {
    const value = twoFactorAuth.trim()
    if (!value) return null
    return { type: 'TOTP', secret: value }
  }

  if (twoFactorAuth.type === 'NONE') return null
  if (twoFactorAuth.type === 'PIN') {
    const pin = twoFactorAuth.pin?.trim() || null
    return pin ? { type: 'PIN', pin } : null
  }
  if (twoFactorAuth.type === 'TOTP') {
    const secret = twoFactorAuth.secret?.trim() || null
    return secret ? { type: 'TOTP', secret } : null
  }
  if (twoFactorAuth.type === 'SMS') return { type: 'SMS' }

  return null
}

export function normalizeAccount(account: Account): Account {
  const apiKeys =
    account.apiKeys
      ?.filter((key) => key.nombre.trim() || key.valor.trim() || key.descripcion.trim())
      .map((key) => ({
        ...key,
        nombre: key.nombre.trim(),
        descripcion: key.descripcion.trim(),
        valor: key.valor.trim(),
      })) ?? []

  return {
    ...account,
    title: (account.title || account.name).trim(),
    name: account.name.trim(),
    username: account.username.trim(),
    accessMethods: normalizeAccessMethods(account.accessMethods),
    hardwareKey: Boolean(account.hardwareKey),
    fullName: account.fullName?.trim() || null,
    birthDate: account.birthDate?.trim() || null,
    accountCreatedAt: account.accountCreatedAt?.trim() || null,
    linkedPhone: account.linkedPhone?.trim() || null,
    twoFactorAuth: normalizeTwoFactor(account.twoFactorAuth),
    notes: account.notes?.trim() || undefined,
    recoveryCodes: account.recoveryCodes?.trim() || undefined,
    apiKeys: apiKeys.length > 0 ? apiKeys : undefined,
  }
}

export function createApiKeyEntry(): ApiKeyEntry {
  return {
    id: crypto.randomUUID(),
    nombre: '',
    descripcion: '',
    valor: '',
  }
}

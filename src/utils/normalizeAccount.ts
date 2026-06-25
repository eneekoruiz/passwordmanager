import type { Account, AccountAccessMethod, ApiKeyEntry, CustomFieldEntry, PasswordHistoryEntry, TwoFactorConfig } from '../types'

export function normalizeAccessMethods(methods: AccountAccessMethod[]): AccountAccessMethod[] {
  return methods
    .map((method) => {
      if (method.type === 'PASSWORD') {
        return { ...method, password: method.password.trim() }
      }
      if (method.type === 'SSO') {
        const anyMethod = method as any
        const providers: string[] = []
        if (Array.isArray(anyMethod.providers)) {
          providers.push(...anyMethod.providers.map((p: any) => String(p).trim()).filter(Boolean))
        } else if (typeof anyMethod.providers === 'string' && anyMethod.providers.trim()) {
          providers.push(anyMethod.providers.trim())
        } else if (typeof anyMethod.provider === 'string' && anyMethod.provider.trim()) {
          providers.push(anyMethod.provider.trim())
        }
        return { 
          id: method.id,
          type: 'SSO' as const,
          providers: [...new Set(providers)],
          email: method.email?.trim() || null 
        }
      }
      if (method.type === 'MAGIC_LINK') {
        return { ...method, email: method.email?.trim() || null }
      }
      return method
    })
    .filter((method) => {
      if (method.type === 'PASSWORD') return (method as any).password.length > 0
      if (method.type === 'SSO') return method.providers.length > 0
      return true
    })
}

function normalizeTwoFactor(twoFactorAuth: Account['twoFactorAuth']): TwoFactorConfig | null {
  if (!twoFactorAuth) return null

  if (typeof twoFactorAuth === 'string') {
    const value = twoFactorAuth.trim()
    if (!value) return null
    return { id: crypto.randomUUID(), type: 'TOTP', secret: value, authenticatorApp: null, phone: null }
  }

  const id = (twoFactorAuth as any).id || crypto.randomUUID()

  if (twoFactorAuth.type === 'NONE') return null
  if (twoFactorAuth.type === 'PIN') {
    const pin = twoFactorAuth.pin?.trim() || null
    return pin ? { id, type: 'PIN', pin, phone: null } : null
  }
  if (twoFactorAuth.type === 'TOTP') {
    const secret = twoFactorAuth.secret?.trim() || null
    const authenticatorApp = twoFactorAuth.authenticatorApp?.trim() || null
    return secret ? { id, type: 'TOTP', secret, authenticatorApp, phone: null } : null
  }
  if (twoFactorAuth.type === 'SMS') {
    const phone = twoFactorAuth.phone?.trim() || null
    return { id, type: 'SMS', phone }
  }

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

  const customFields: CustomFieldEntry[] =
    account.customFields
      ?.filter((field) => field.key.trim() || field.value.trim())
      .map((field) => ({
        id: field.id || crypto.randomUUID(),
        key: field.key.trim(),
        value: field.value.trim(),
        protected: Boolean(field.protected),
        type: (field as any).type || undefined,
        options: (field as any).options || undefined,
      })) ?? []

  const passwordHistory: PasswordHistoryEntry[] =
    account.passwordHistory
      ?.filter((entry) => entry.password.trim())
      .map((entry) => ({
        id: entry.id || crypto.randomUUID(),
        password: entry.password,
        changedAt: entry.changedAt || new Date().toISOString(),
      }))
      .slice(-10) ?? []

  let normalized2FAs: TwoFactorConfig[] = []
  if (Array.isArray(account.twoFactorAuths)) {
    normalized2FAs = account.twoFactorAuths
      .map((cfg): TwoFactorConfig | null => {
        if (!cfg || cfg.type === 'NONE') return null
        const id = cfg.id || crypto.randomUUID()
        if (cfg.type === 'PIN') {
          const pin = cfg.pin?.trim() || null
          return pin ? { id, type: 'PIN', pin, phone: null } : null
        }
        if (cfg.type === 'TOTP') {
          const secret = cfg.secret?.trim() || null
          const authenticatorApp = cfg.authenticatorApp?.trim() || null
          return secret ? { id, type: 'TOTP', secret, authenticatorApp, phone: null } : null
        }
        if (cfg.type === 'SMS') {
          const phone = cfg.phone?.trim() || null
          return { id, type: 'SMS', phone }
        }
        return null
      })
      .filter((cfg): cfg is TwoFactorConfig => cfg !== null)
  } else if (account.twoFactorAuth) {
    const legacy = normalizeTwoFactor(account.twoFactorAuth)
    if (legacy) {
      normalized2FAs = [legacy]
    }
  }

  const primary2FA = normalized2FAs[0] || null

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
    twoFactorAuth: primary2FA,
    twoFactorAuths: normalized2FAs,
    notes: account.notes?.trim() || undefined,
    recoveryCodes: account.recoveryCodes?.trim() || undefined,
    apiKeys: apiKeys.length > 0 ? apiKeys : undefined,
    customFields: customFields.length > 0 ? customFields : undefined,
    passwordHistory: passwordHistory.length > 0 ? passwordHistory : undefined,
    sensitive: Boolean(account.sensitive),
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

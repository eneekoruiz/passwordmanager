import type { Account, AccountAccessMethod, ApiKeyEntry } from '../types'

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
    linkedPhone: account.linkedPhone?.trim() || null,
    twoFactorAuth: account.twoFactorAuth?.trim() || null,
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

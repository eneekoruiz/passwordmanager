import type { Account, ApiKeyEntry } from '../types'

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
    name: account.name.trim(),
    username: account.username.trim(),
    fullName: account.fullName?.trim() || null,
    linkedPhone: account.linkedPhone?.trim() || null,
    twoFactorAuth: account.twoFactorAuth?.trim() || null,
    linkedGoogleAccount: account.linkedGoogleAccount?.trim() || null,
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

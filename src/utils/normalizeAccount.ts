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
    title: (account.title || account.name).trim(),
    name: account.name.trim(),
    username: account.username.trim(),
    password: account.authMethod === 'PASSWORD' ? account.password?.trim() || '' : null,
    ssoProvider: account.authMethod === 'SSO' ? account.ssoProvider ?? 'Google' : null,
    ssoEmail: account.authMethod === 'SSO' ? account.ssoEmail?.trim() || null : null,
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

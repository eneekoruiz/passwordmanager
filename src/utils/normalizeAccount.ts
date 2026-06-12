import type { Account, ApiKeyEntry } from '../types'

export function normalizeAccount(account: Account): Account {
  const apiKeys =
    account.apiKeys
      ?.filter((key) => key.name.trim() || key.value.trim())
      .map((key) => ({
        ...key,
        name: key.name.trim(),
        value: key.value.trim(),
      })) ?? []

  return {
    ...account,
    username: account.username.trim(),
    email: account.email.trim(),
    phone: account.phone?.trim() || undefined,
    notes: account.notes?.trim() || undefined,
    recoveryCodes: account.recoveryCodes?.trim() || undefined,
    apiKeys: apiKeys.length > 0 ? apiKeys : undefined,
  }
}

export function createApiKeyEntry(): ApiKeyEntry {
  return {
    id: crypto.randomUUID(),
    name: '',
    value: '',
  }
}

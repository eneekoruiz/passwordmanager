import type { Account } from '../types'
import { generateId } from './id'

export function createEmptyAccount(): Account {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    name: '',
    username: '',
    password: '',
    linkedPhone: null,
    linkedGoogleAccount: null,
    notes: '',
    apiKeys: [],
    recoveryCodes: '',
    createdAt: now,
    updatedAt: now,
  }
}

export function accountDisplayName(account: Account): string {
  if (account.name.trim()) return account.name
  if (account.username.trim()) return account.username
  return 'Cuenta sin nombre'
}

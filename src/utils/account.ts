import type { Account } from '../types'
import { generateId } from './id'

export function createEmptyAccount(): Account {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    username: '',
    email: '',
    password: '',
    phone: '',
    notes: '',
    apiKeys: [],
    recoveryCodes: '',
    createdAt: now,
    updatedAt: now,
  }
}

export function accountDisplayName(account: Account): string {
  if (account.username.trim()) return account.username
  if (account.email.trim()) return account.email
  return 'Cuenta sin nombre'
}

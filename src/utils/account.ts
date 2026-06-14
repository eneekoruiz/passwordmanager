import type { Account } from '../types'
import { generateId } from './id'

export function createEmptyAccount(): Account {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    type: 'ACCOUNT',
    title: '',
    name: '',
    username: '',
    accessMethods: [{ id: generateId(), type: 'PASSWORD', password: '' }],
    hardwareKey: false,
    fullName: null,
    linkedPhone: null,
    twoFactorAuth: null,
    notes: '',
    apiKeys: [],
    recoveryCodes: '',
    createdAt: now,
    updatedAt: now,
  }
}

export function accountDisplayName(account: Account): string {
  if (account.name.trim()) return account.name
  if (account.title.trim()) return account.title
  if (account.username.trim()) return account.username
  return 'Cuenta sin nombre'
}

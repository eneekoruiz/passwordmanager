import type { Account, Identity, Platform } from '../types'
import { generateId } from './id'

export const LOCAL_IDENTITY_EMAIL = 'Cuentas Locales / Sin Correo'

function nowIso(): string {
  return new Date().toISOString()
}

export function createIdentity(email = LOCAL_IDENTITY_EMAIL): Identity {
  const now = nowIso()
  return {
    id: generateId(),
    email: email.trim() || LOCAL_IDENTITY_EMAIL,
    platforms: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function createPlatform(name: string, defaults?: Partial<Platform>): Platform {
  const now = nowIso()
  return {
    id: defaults?.id ?? generateId(),
    name: name.trim(),
    username: defaults?.username ?? '',
    password: defaults?.password ?? '',
    fullName: defaults?.fullName ?? null,
    linkedPhone: defaults?.linkedPhone ?? null,
    twoFactorAuth: defaults?.twoFactorAuth ?? null,
    linkedGoogleAccount: defaults?.linkedGoogleAccount ?? null,
    notes: defaults?.notes,
    apiKeys: defaults?.apiKeys ?? [],
    recoveryCodes: defaults?.recoveryCodes,
    createdAt: defaults?.createdAt ?? now,
    updatedAt: now,
  }
}

type LegacyAccount = Partial<Account> & {
  email?: string
  phone?: string
}

function isLegacyPlatform(value: unknown): value is {
  id: string
  name: string
  accounts: LegacyAccount[]
  createdAt: string
  updatedAt: string
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'accounts' in value &&
    Array.isArray((value as { accounts?: unknown }).accounts)
  )
}

export function normalizeIdentityRecord(record: unknown): Identity {
  if (
    typeof record === 'object' &&
    record !== null &&
    'email' in record &&
    'platforms' in record &&
    Array.isArray((record as { platforms?: unknown }).platforms)
  ) {
    const identity = record as Identity
    return {
      ...identity,
      email: identity.email?.trim() || LOCAL_IDENTITY_EMAIL,
      platforms: identity.platforms.map((platform) =>
        createPlatform(platform.name, {
          ...platform,
          fullName: platform.fullName ?? null,
          linkedPhone: platform.linkedPhone ?? null,
          twoFactorAuth: platform.twoFactorAuth ?? null,
          linkedGoogleAccount: platform.linkedGoogleAccount ?? null,
        }),
      ),
    }
  }

  if (isLegacyPlatform(record)) {
    const localIdentity = createIdentity(LOCAL_IDENTITY_EMAIL)
    localIdentity.createdAt = record.createdAt
    localIdentity.updatedAt = record.updatedAt
    localIdentity.platforms = record.accounts.map((account) =>
      createPlatform(record.name, {
        ...account,
        username: account.username ?? account.email ?? '',
        fullName: account.fullName ?? null,
        linkedPhone: account.linkedPhone ?? account.phone ?? null,
        twoFactorAuth: account.twoFactorAuth ?? null,
        linkedGoogleAccount: account.linkedGoogleAccount ?? null,
      }),
    )
    return localIdentity
  }

  return createIdentity()
}

export function identityMatchesEmail(identity: Identity, email: string): boolean {
  return identity.email.trim().toLowerCase() === email.trim().toLowerCase()
}

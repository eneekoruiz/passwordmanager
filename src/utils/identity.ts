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
  const legacyGoogleAccount = (defaults as { linkedGoogleAccount?: string | null } | undefined)?.linkedGoogleAccount
  const authMethod = defaults?.authMethod ?? (legacyGoogleAccount ? 'SSO' : 'PASSWORD')
  return {
    id: defaults?.id ?? generateId(),
    type: 'ACCOUNT',
    title: (defaults?.title ?? name).trim(),
    name: name.trim(),
    username: defaults?.username ?? '',
    password: defaults?.password ?? '',
    authMethod,
    ssoProvider: defaults?.ssoProvider ?? (legacyGoogleAccount ? 'Google' : null),
    ssoEmail: defaults?.ssoEmail ?? legacyGoogleAccount ?? null,
    hardwareKey: defaults?.hardwareKey ?? false,
    fullName: defaults?.fullName ?? null,
    linkedPhone: defaults?.linkedPhone ?? null,
    twoFactorAuth: defaults?.twoFactorAuth ?? null,
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
  linkedGoogleAccount?: string | null
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
          title: platform.title ?? platform.name,
          authMethod: platform.authMethod ?? ((platform as { linkedGoogleAccount?: string | null }).linkedGoogleAccount ? 'SSO' : 'PASSWORD'),
          ssoProvider: platform.ssoProvider ?? ((platform as { linkedGoogleAccount?: string | null }).linkedGoogleAccount ? 'Google' : null),
          ssoEmail: platform.ssoEmail ?? (platform as { linkedGoogleAccount?: string | null }).linkedGoogleAccount ?? null,
          hardwareKey: platform.hardwareKey ?? false,
          fullName: platform.fullName ?? null,
          linkedPhone: platform.linkedPhone ?? null,
          twoFactorAuth: platform.twoFactorAuth ?? null,
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
        title: account.title ?? record.name,
        username: account.username ?? account.email ?? '',
        authMethod: account.authMethod ?? (account.linkedGoogleAccount ? 'SSO' : 'PASSWORD'),
        ssoProvider: account.ssoProvider ?? (account.linkedGoogleAccount ? 'Google' : null),
        ssoEmail: account.ssoEmail ?? account.linkedGoogleAccount ?? null,
        hardwareKey: account.hardwareKey ?? false,
        fullName: account.fullName ?? null,
        linkedPhone: account.linkedPhone ?? account.phone ?? null,
        twoFactorAuth: account.twoFactorAuth ?? null,
      }),
    )
    return localIdentity
  }

  return createIdentity()
}

export function identityMatchesEmail(identity: Identity, email: string): boolean {
  return identity.email.trim().toLowerCase() === email.trim().toLowerCase()
}

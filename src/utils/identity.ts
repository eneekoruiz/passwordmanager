import type { Account, AccountAccessMethod, Identity, Platform } from '../types'
import { generateId } from './id'
import { normalizeAccessMethods as fullNormalizeAccessMethods } from './normalizeAccount'

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

function createPasswordMethod(password = ''): AccountAccessMethod {
  return {
    id: generateId(),
    type: 'PASSWORD',
    password,
  }
}

function normalizeAccessMethods(defaults?: Partial<Platform>): AccountAccessMethod[] {
  let methods: AccountAccessMethod[] = []

  if (defaults?.accessMethods?.length) {
    methods = defaults.accessMethods.map((method) => ({ ...method }))
  } else {
    const legacy = defaults as
      | (Partial<Platform> & {
          authMethod?: string
          password?: string | null
          ssoProvider?: Platform['accessMethods'][number] extends infer T
            ? T extends { providers: (infer P)[] }
              ? P
              : never
            : never
          ssoEmail?: string | null
          linkedGoogleAccount?: string | null
        })
      | undefined
    const legacyGoogleAccount = legacy?.linkedGoogleAccount

    if (legacy?.authMethod === 'SSO' || legacyGoogleAccount) {
      methods = [
        {
          id: generateId(),
          type: 'SSO',
          providers: legacy?.ssoProvider ? [legacy.ssoProvider as any] : ['Google'],
          email: legacy?.ssoEmail ?? legacyGoogleAccount ?? null,
        },
      ]
    } else if (legacy?.authMethod === 'PASSKEY') {
      methods = [{ id: generateId(), type: 'PASSKEY' }]
    } else if (legacy?.authMethod === 'MAGIC_LINK') {
      methods = [{ id: generateId(), type: 'MAGIC_LINK', email: legacy?.ssoEmail ?? null }]
    } else {
      methods = [createPasswordMethod(legacy?.password ?? '')]
    }
  }

  return fullNormalizeAccessMethods(methods)
}

export function createPlatform(name: string, defaults?: Partial<Platform>): Platform {
  const now = nowIso()
  return {
    id: defaults?.id ?? generateId(),
    type: 'ACCOUNT',
    title: (defaults?.title ?? name).trim(),
    name: name.trim(),
    username: defaults?.username ?? '',
    accessMethods: normalizeAccessMethods(defaults),
    hardwareKey: defaults?.hardwareKey ?? false,
    fullName: defaults?.fullName ?? null,
    birthDate: defaults?.birthDate ?? null,
    accountCreatedAt: defaults?.accountCreatedAt ?? null,
    linkedPhone: defaults?.linkedPhone ?? null,
    twoFactorAuth: defaults?.twoFactorAuth ?? null,
    notes: defaults?.notes,
    apiKeys: defaults?.apiKeys ?? [],
    recoveryCodes: defaults?.recoveryCodes,
    customFields: defaults?.customFields ?? [],
    passwordHistory: defaults?.passwordHistory ?? [],
    sensitive: defaults?.sensitive ?? false,
    createdAt: defaults?.createdAt ?? now,
    updatedAt: now,
  }
}

type LegacyAccount = Partial<Account> & {
  email?: string
  phone?: string
  linkedGoogleAccount?: string | null
  authMethod?: string
  password?: string | null
  ssoEmail?: string | null
  ssoProvider?: AccountAccessMethod extends infer T
    ? T extends { providers: (infer P)[] }
      ? P
      : never
    : never
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
          accessMethods: normalizeAccessMethods(platform),
          hardwareKey: platform.hardwareKey ?? false,
          fullName: platform.fullName ?? null,
          birthDate: platform.birthDate ?? null,
          accountCreatedAt: platform.accountCreatedAt ?? null,
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
        accessMethods: normalizeAccessMethods(account),
        hardwareKey: account.hardwareKey ?? false,
        fullName: account.fullName ?? null,
        birthDate: account.birthDate ?? null,
        accountCreatedAt: account.accountCreatedAt ?? null,
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

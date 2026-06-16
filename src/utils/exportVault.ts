import type { Identity, LocalVaultItem, Platform, TwoFactorConfig } from '../types'
import { POPULAR_SERVICES } from '../data/popularServices'

const CSV_HEADERS = [
  'Platform',
  'Login URL',
  'Username',
  'Password',
  '2FA App',
  '2FA Setup Key',
  'Notes',
  'Recovery Codes',
  'Extra Details',
] as const

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function platformUrl(platformName: string): string {
  const service = POPULAR_SERVICES.find(
    (item) => item.name.toLowerCase() === platformName.trim().toLowerCase(),
  )
  return service ? `https://${service.domain}` : ''
}

function passwordFor(platform: Platform): string {
  return platform.accessMethods.find((method) => method.type === 'PASSWORD')?.password ?? ''
}

function totpFor(platform: Platform): { app: string; secret: string } {
  const value = platform.twoFactorAuth
  if (!value) return { app: '', secret: '' }
  if (typeof value === 'string') return { app: '', secret: value }
  const config = value as TwoFactorConfig
  return config.type === 'TOTP'
    ? { app: config.authenticatorApp ?? '', secret: config.secret ?? '' }
    : { app: '', secret: '' }
}

function extraFor(platform: Platform, identityEmail: string): string {
  const parts: string[] = []
  if (platform.fullName) parts.push(`Nombre completo: ${platform.fullName}`)
  if (platform.birthDate) parts.push(`Fecha de nacimiento: ${platform.birthDate}`)
  if (platform.accountCreatedAt) parts.push(`Fecha de creacion de cuenta: ${platform.accountCreatedAt}`)
  if (platform.linkedPhone) parts.push(`Telefono: ${platform.linkedPhone}`)
  if (platform.hardwareKey) parts.push('Llave fisica: activada')
  for (const method of platform.accessMethods) {
    if (method.type === 'SSO') parts.push(`SSO ${method.provider}: ${method.email ?? identityEmail}`)
    if (method.type === 'PASSKEY') parts.push('Passkey: activada')
    if (method.type === 'MAGIC_LINK') parts.push(`Magic Link: ${method.email ?? identityEmail}`)
  }
  if (platform.apiKeys?.length) {
    parts.push(
      `API Keys:\n${platform.apiKeys
        .map((key) => `${key.nombre || 'Sin nombre'}: ${key.valor}${key.descripcion ? ` (${key.descripcion})` : ''}`)
        .join('\n')}`,
    )
  }
  return parts.join('\n\n')
}

export function buildPlaintextCsv(identities: Identity[]): string {
  const rows = identities.flatMap((identity) =>
    identity.platforms.map((platform) => {
      const totp = totpFor(platform)
      return [
        platform.name,
        platformUrl(platform.name),
        platform.username || identity.email,
        passwordFor(platform),
        totp.app,
        totp.secret,
        platform.notes ?? '',
        platform.recoveryCodes ?? '',
        extraFor(platform, identity.email),
      ]
    }),
  )
  return [CSV_HEADERS.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\r\n')
}

export function buildPlaintextJson(identities: Identity[], localItems: LocalVaultItem[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      format: 'contras-plaintext-export-v1',
      warning: 'PLAINTEXT_EXPORT_UNENCRYPTED',
      identities,
      localItems,
    },
    null,
    2,
  )
}

export function downloadPlaintextFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

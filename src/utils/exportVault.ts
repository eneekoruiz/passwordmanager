import type { Identity, LocalVaultItem, Platform, TwoFactorConfig } from '../types'
import { POPULAR_SERVICES } from '../data/popularServices'

const CSV_HEADERS = ['url', 'username', 'password', 'totp', 'extra', 'name'] as const

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value)
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

function totpFor(platform: Platform): string {
  const value = platform.twoFactorAuth
  if (!value) return ''
  if (typeof value === 'string') return value
  const config = value as TwoFactorConfig
  return config.type === 'TOTP' ? config.secret ?? '' : ''
}

function extraFor(platform: Platform, identityEmail: string): string {
  const parts: string[] = []
  if (platform.fullName) parts.push(`Nombre completo: ${platform.fullName}`)
  if (platform.birthDate) parts.push(`Fecha de nacimiento: ${platform.birthDate}`)
  if (platform.accountCreatedAt) parts.push(`Fecha de creacion de cuenta: ${platform.accountCreatedAt}`)
  if (platform.linkedPhone) parts.push(`Telefono: ${platform.linkedPhone}`)
  if (platform.hardwareKey) parts.push('Llave fisica: activada')
  if (platform.recoveryCodes) parts.push(`Codigos de recuperacion:\n${platform.recoveryCodes}`)
  if (platform.notes) parts.push(`Notas:\n${platform.notes}`)
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
    identity.platforms.map((platform) => [
      platformUrl(platform.name),
      platform.username || identity.email,
      passwordFor(platform),
      totpFor(platform),
      extraFor(platform, identity.email),
      platform.name,
    ]),
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

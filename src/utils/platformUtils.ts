import { POPULAR_SERVICES } from '../data/popularServices'

const canonicalNamesCache = new Map<string, string>()

/**
 * Returns the canonical platform name with correct capitalization if found
 * in the POPULAR_SERVICES list. Otherwise, returns the original string.
 */
export function getCanonicalPlatformName(name: string): string {
  if (!name) return ''
  const clean = name.trim().toLowerCase()
  
  if (canonicalNamesCache.size === 0) {
    POPULAR_SERVICES.forEach((service) => {
      const key = service.name.toLowerCase()
      if (!canonicalNamesCache.has(key)) {
        canonicalNamesCache.set(key, service.name)
      }
    })
  }

  return canonicalNamesCache.get(clean) || name
}

const serviceDomainCache = new Map<string, string>()

/**
 * Checks whether a URL uses an explicit safe HTTP(S) protocol.
 */
export function isSafeHttpUrl(url: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Returns the best platform login/home URL, blocking non-HTTP(S) schemes such as javascript: or data:.
 * Checks POPULAR_SERVICES for exact or known domains.
 */
export function getPlatformUrl(name: string): string {
  if (!name) return ''
  const trimmed = name.trim()
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return isSafeHttpUrl(trimmed) ? trimmed : ''
  }

  const clean = trimmed.toLowerCase().replace(/^\/+/, '')
  if (!clean || /[\s<>"'`\\]/.test(clean)) {
    // Allow service names with spaces to still match known popular services
    const knownByName = findKnownDomain(trimmed.toLowerCase())
    return knownByName ? `https://${knownByName}` : ''
  }

  const knownDomain = findKnownDomain(clean)
  if (knownDomain) {
    return `https://${knownDomain}`
  }

  if (clean.includes('.')) {
    const candidate = `https://${clean}`
    return isSafeHttpUrl(candidate) ? candidate : ''
  }

  const fallback = `https://${clean}.com`
  return isSafeHttpUrl(fallback) ? fallback : ''
}

function findKnownDomain(clean: string): string | undefined {
  if (serviceDomainCache.size === 0) {
    POPULAR_SERVICES.forEach((service) => {
      const key = service.name.toLowerCase()
      if (!serviceDomainCache.has(key) && service.domain) {
        serviceDomainCache.set(key, service.domain)
      }
      if (service.aliases) {
        service.aliases.forEach((alias) => {
          const aKey = alias.toLowerCase()
          if (!serviceDomainCache.has(aKey) && service.domain) {
            serviceDomainCache.set(aKey, service.domain)
          }
        })
      }
    })
  }
  return serviceDomainCache.get(clean)
}

/**
 * Opens an external platform URL safely in a new tab with noopener,noreferrer.
 */
export function openExternalUrl(nameOrUrl: string): boolean {
  const url = getPlatformUrl(nameOrUrl)
  if (!url || !isSafeHttpUrl(url) || typeof window === 'undefined') return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

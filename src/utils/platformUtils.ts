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
 * Returns the best platform login/home URL.
 * Checks POPULAR_SERVICES for exact or known domains.
 */
export function getPlatformUrl(name: string): string {
  if (!name) return ''
  const trimmed = name.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  const clean = trimmed.toLowerCase()

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

  const knownDomain = serviceDomainCache.get(clean)
  if (knownDomain) {
    return `https://${knownDomain}`
  }

  if (clean.includes('.')) {
    return `https://${clean}`
  }

  return `https://${clean}.com`
}

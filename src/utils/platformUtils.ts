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

import { POPULAR_SERVICES } from '../data/popularServices'

/**
 * Returns the canonical platform name with correct capitalization if found
 * in the POPULAR_SERVICES list. Otherwise, returns the original string.
 */
export function getCanonicalPlatformName(name: string): string {
  if (!name) return ''
  const clean = name.trim().toLowerCase()
  const known = POPULAR_SERVICES.find((service) => service.name.toLowerCase() === clean)
  return known ? known.name : name
}

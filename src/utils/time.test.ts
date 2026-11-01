import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './time'

describe('formatRelativeTime', () => {
  it('returns empty string for null or undefined input', () => {
    expect(formatRelativeTime(null)).toBe('')
    expect(formatRelativeTime(undefined)).toBe('')
  })

  it('formats recent events as "hace unos segundos"', () => {
    const recent = new Date(Date.now() - 10 * 1000).toISOString()
    expect(formatRelativeTime(recent)).toBe('hace unos segundos')
  })

  it('formats 1 minute correctly', () => {
    const oneMinAgo = new Date(Date.now() - 65 * 1000).toISOString()
    expect(formatRelativeTime(oneMinAgo)).toBe('hace 1 minuto')
  })

  it('formats multiple minutes correctly', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(formatRelativeTime(fiveMinAgo)).toBe('hace 5 minutos')
  })

  it('formats 1 hour correctly', () => {
    const oneHourAgo = new Date(Date.now() - 65 * 60 * 1000).toISOString()
    expect(formatRelativeTime(oneHourAgo)).toBe('hace 1 hora')
  })

  it('formats hours and days correctly', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString()
    expect(formatRelativeTime(threeHoursAgo)).toBe('hace 3 horas')

    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString()
    expect(formatRelativeTime(twoDaysAgo)).toBe('hace 2 días')
  })
})

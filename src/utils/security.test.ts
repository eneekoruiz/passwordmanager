import { describe, expect, it } from 'vitest'

import {
  generateSecurePassword,
  generateSecurePasswordWithOptions,
  isAccountVerified,
  isAccountUnverified,
  platformHasUnverifiedAccounts,
} from './security'

describe('password generation', () => {
  it('generates a strong default password with every enabled class', () => {
    const password = generateSecurePassword(24)

    expect(password).toHaveLength(24)
    expect(/[a-z]/.test(password)).toBe(true)
    expect(/[A-Z]/.test(password)).toBe(true)
    expect(/[0-9]/.test(password)).toBe(true)
    expect(/[^A-Za-z0-9]/.test(password)).toBe(true)
  })

  it('honors disabled character classes', () => {
    const password = generateSecurePasswordWithOptions(20, {
      uppercase: false,
      numbers: false,
      symbols: false,
    })

    expect(password).toHaveLength(20)
    expect(/^[a-z]+$/.test(password)).toBe(true)
  })
})

describe('account verification logic (without time expiration)', () => {
  const basePlatform = {
    id: 'plat-1',
    name: 'GitHub',
    type: 'login' as const,
    accessMethods: [{ id: 'm1', type: 'PASSWORD' as const, password: 'password123' }],
  }

  it('marks platform as unverified if lastVerifiedDate is undefined (legacy data)', () => {
    expect(isAccountUnverified(basePlatform)).toBe(true)
    expect(isAccountVerified(basePlatform)).toBe(false)
  })

  it('marks platform as verified if lastVerifiedDate is defined and lastUpdatedDate is undefined', () => {
    const plat = { ...basePlatform, lastVerifiedDate: '2024-06-01T12:00:00Z' }
    expect(isAccountVerified(plat)).toBe(true)
    expect(isAccountUnverified(plat)).toBe(false)
  })

  it('supports backwards compatibility with lastVerifiedAt', () => {
    const plat = { ...basePlatform, lastVerifiedAt: '2024-06-01T12:00:00Z' }
    expect(isAccountVerified(plat)).toBe(true)
    expect(isAccountUnverified(plat)).toBe(false)
  })

  it('marks platform as verified if lastUpdatedDate is prior to or equal to lastVerifiedDate', () => {
    const plat = {
      ...basePlatform,
      lastUpdatedDate: '2024-06-01T10:00:00Z',
      lastVerifiedDate: '2024-06-01T12:00:00Z',
    }
    expect(isAccountVerified(plat)).toBe(true)
    expect(isAccountUnverified(plat)).toBe(false)
  })

  it('marks platform as unverified if lastUpdatedDate is posterior to lastVerifiedDate (password modified after verification)', () => {
    const plat = {
      ...basePlatform,
      lastVerifiedDate: '2024-06-01T10:00:00Z',
      lastUpdatedDate: '2024-06-01T12:00:00Z',
    }
    expect(isAccountUnverified(plat)).toBe(true)
    expect(isAccountVerified(plat)).toBe(false)
  })

  it('evaluates platformHasUnverifiedAccounts correctly across account lists', () => {
    const verifiedPlat = { ...basePlatform, id: 'plat-1', lastVerifiedDate: '2024-06-01T12:00:00Z' }
    const unverifiedPlat = { ...basePlatform, id: 'plat-2' }

    expect(platformHasUnverifiedAccounts([])).toBe(false)
    expect(platformHasUnverifiedAccounts([verifiedPlat])).toBe(false)
    expect(platformHasUnverifiedAccounts([verifiedPlat, unverifiedPlat])).toBe(true)
  })
})

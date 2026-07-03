import { describe, expect, it } from 'vitest'

import { generateSecurePassword, generateSecurePasswordWithOptions } from './security'

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

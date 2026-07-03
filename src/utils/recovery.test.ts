import { describe, expect, it } from 'vitest'

import { RECOVERY_PHRASE_WORD_COUNT, generateRecoveryPhrase, normalizeRecoveryPhrase } from './recovery'

describe('recovery phrases', () => {
  it('generates the stronger default word count', () => {
    const phrase = generateRecoveryPhrase()
    expect(phrase.split(' ')).toHaveLength(RECOVERY_PHRASE_WORD_COUNT)
  })

  it('normalizes whitespace and casing without changing words', () => {
    expect(normalizeRecoveryPhrase('  Acero   Norte  ')).toBe('acero norte')
  })
})

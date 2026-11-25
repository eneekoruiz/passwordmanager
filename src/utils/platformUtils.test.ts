import { describe, expect, it } from 'vitest'
import { getPlatformUrl, isSafeHttpUrl } from './platformUtils'

describe('platformUtils security and URL resolution', () => {
  it('blocks dangerous non-HTTP schemes like javascript: and data:', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(getPlatformUrl('javascript:alert(1)')).toBe('')
    expect(getPlatformUrl('vbscript:msgbox(1)')).toBe('')
    expect(getPlatformUrl('data:text/plain;base64,SGVsbG8=')).toBe('')
  })

  it('allows explicit HTTP(S) URLs and resolves known platforms', () => {
    expect(getPlatformUrl('https://github.com/login')).toBe('https://github.com/login')
    expect(getPlatformUrl('GitHub')).toBe('https://github.com')
    expect(getPlatformUrl('custom.internal.org')).toBe('https://custom.internal.org')
  })
})

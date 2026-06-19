import { describe, expect, it } from 'vitest'

import {
  base64ToBytes,
  bytesToArrayBuffer,
  bytesToBase64,
  bytesToString,
  stringToBytes,
} from './encoding'

describe('crypto encoding', () => {
  it('round-trips arbitrary UTF-8 text through Base64', () => {
    const original = 'contraseña segura 🔐 日本語'
    const encoded = bytesToBase64(stringToBytes(original))
    expect(bytesToString(base64ToBytes(encoded))).toBe(original)
  })

  it('returns an independent ArrayBuffer for Web Crypto', () => {
    const source = new Uint8Array([1, 2, 3])
    const buffer = bytesToArrayBuffer(source)
    source[0] = 99
    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(Array.from(new Uint8Array(buffer))).toEqual([1, 2, 3])
  })
})
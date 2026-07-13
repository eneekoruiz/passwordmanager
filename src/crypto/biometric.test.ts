import { describe, expect, it } from 'vitest'
import { isMissingBiometricCredentialError } from './biometric'

describe('isMissingBiometricCredentialError', () => {
  it('detecta una credencial que ya no existe', () => {
    const error = new DOMException('No matching credentials were found', 'NotAllowedError')
    expect(isMissingBiometricCredentialError(error)).toBe(true)
  })

  it('no confunde un timeout ambiguo de Safari con una credencial eliminada', () => {
    const error = new DOMException('The operation timed out or was not allowed', 'NotAllowedError')
    expect(isMissingBiometricCredentialError(error)).toBe(false)
  })

  it('no elimina el registro cuando la petición fue abortada por el fallback', () => {
    const error = new DOMException('The operation was aborted', 'AbortError')
    expect(isMissingBiometricCredentialError(error)).toBe(false)
  })
})

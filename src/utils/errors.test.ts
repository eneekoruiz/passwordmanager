import { describe, expect, it } from 'vitest'
import {
  FIREBASE_AUTH_RECOVERY_MESSAGE,
  getFriendlyErrorMessage,
  isRecoverableFirebaseAuthError,
} from './errors'

describe('Firebase mobile auth error recovery', () => {
  it.each([
    { code: 'auth/internal-error', message: 'Firebase: Error (auth/internal-error).' },
    { message: 'Unable to save initial state. This may happen if browser sessionStorage is inaccessible.' },
    { message: 'The request is not allowed by the user agent or the platform in the current context.' },
    { code: 'auth/web-storage-unsupported', message: 'Web storage is unavailable.' },
  ])('recognizes recoverable Safari/Firebase failures', (error) => {
    expect(isRecoverableFirebaseAuthError(error)).toBe(true)
  })

  it('does not classify a user-closed popup as corrupted state', () => {
    expect(
      isRecoverableFirebaseAuthError({
        code: 'auth/popup-closed-by-user',
        message: 'The popup has been closed by the user.',
      }),
    ).toBe(false)
  })

  it('never exposes the Firebase internal error to the user', () => {
    expect(
      getFriendlyErrorMessage(
        { code: 'auth/internal-error', message: 'Unable to save initial state.' },
        'fallback',
      ),
    ).toBe(FIREBASE_AUTH_RECOVERY_MESSAGE)
  })
})
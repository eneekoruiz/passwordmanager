import { afterEach, describe, expect, it, vi } from 'vitest'
import { bytesToBase64 } from './encoding'
import {
  getBiometricUnavailableMessage,
  isBiometricAvailable,
  isMissingBiometricCredentialError,
  registerBiometricCredential,
  unlockWithBiometrics,
} from './biometric'

const originalWindow = globalThis.window
const originalLocalStorage = globalThis.localStorage
const originalNavigator = globalThis.navigator

function installStorageMock() {
  const store = new Map<string, string>()
  const storageMock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: storageMock,
    configurable: true,
  })
  return { store, storageMock }
}

afterEach(() => {
  vi.restoreAllMocks()
  if (originalWindow === undefined) {
    delete (globalThis as Record<string, unknown>).window
  } else {
    Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true })
  }
  if (originalLocalStorage === undefined) {
    delete (globalThis as Record<string, unknown>).localStorage
  } else {
    Object.defineProperty(globalThis, 'localStorage', { value: originalLocalStorage, configurable: true })
  }
  if (originalNavigator === undefined) {
    delete (globalThis as Record<string, unknown>).navigator
  } else {
    Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true })
  }
})

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

describe('strict WebAuthn PRF enforcement', () => {
  it('reports unavailable when client capabilities explicitly exclude prf', async () => {
    const fakeWindow = {
      location: { hostname: 'localhost' },
      PublicKeyCredential: {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn(async () => true),
        getClientCapabilities: vi.fn(async () => ({ prf: false })),
      },
    }
    Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true })

    expect(await isBiometricAvailable()).toBe(false)
  })

  it('rejects enrollment without PRF output and never writes insecurePrfKey to localStorage', async () => {
    const { store } = installStorageMock()
    store.set('contras.biometric.insecurePrfKey.default', 'legacy-secret')

    const fakeWindow = {
      location: { hostname: 'localhost' },
      PublicKeyCredential: {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn(async () => true),
        getClientCapabilities: vi.fn(async () => ({ prf: true })),
      },
    }
    Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true })
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        credentials: {
          create: vi.fn(async () => ({
            rawId: new Uint8Array([1, 2, 3, 4]).buffer,
            getClientExtensionResults: () => ({}),
          })),
        },
      },
      configurable: true,
    })

    await expect(
      registerBiometricCredential('MasterPass123!', 'default', 'user@example.com'),
    ).rejects.toThrow(getBiometricUnavailableMessage())

    expect(store.has('contras.biometric.insecurePrfKey.default')).toBe(false)
  })

  it('rejects unlock without PRF output and purges any legacy insecurePrfKey', async () => {
    const { store } = installStorageMock()
    store.set('contras.biometric.insecurePrfKey.default', 'legacy-secret')

    const rawId = new Uint8Array([1, 2, 3, 4])
    const fakeWindow = { location: { hostname: 'localhost' } }
    Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true })
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        credentials: {
          get: vi.fn(async () => ({
            rawId: rawId.buffer,
            getClientExtensionResults: () => ({}),
          })),
        },
      },
      configurable: true,
    })

    await expect(
      unlockWithBiometrics({
        profileId: 'default',
        credentialId: bytesToBase64(rawId),
        encryptedPassword: { v: 1, iv: 'AAAA', data: 'AAAA' },
        createdAt: '2026-01-01T00:00:00.000Z',
        rpId: 'localhost',
      }),
    ).rejects.toThrow(/WebAuthn PRF/i)

    expect(store.has('contras.biometric.insecurePrfKey.default')).toBe(false)
  })
})

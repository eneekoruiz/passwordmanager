/**
 * @module biometric
 * @description Desbloqueo local con WebAuthn PRF.
 *
 * Nota importante: en navegadores moviles, Face ID / Touch ID se exponen a la web
 * como una llave de acceso (passkey) local. No existe una API web que permita
 * usar Face ID "puro" para derivar claves criptograficas. Por eso este modulo
 * solo se activa cuando el navegador puede usar WebAuthn + PRF de forma fiable.
 */

import {
  base64ToBytes,
  bytesToArrayBuffer,
  bytesToBase64,
  bytesToString,
  stringToBytes,
} from './encoding'
import type { EncryptedPayload } from './types'

const BIOMETRIC_RP_NAME = 'Contras Password Manager'
const BIOMETRIC_PRF_SALT = stringToBytes('contras-prf-v1-unlock')

export interface BiometricBundle {
  profileId: string
  credentialId: string
  encryptedPassword: EncryptedPayload
  createdAt: string
  discoverable?: boolean
  rpId?: string
}

function getRpId(): string {
  return window.location.hostname
}

function isAppleWebKitWithoutExplicitPrfSignal(): boolean {
  const ua = navigator.userAgent
  const isAppleDevice = /iPad|iPhone|iPod|Macintosh/i.test(ua)
  const isWebKit = /AppleWebKit/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)
  return isAppleDevice && isWebKit
}

async function isWebAuthnPrfAvailable(): Promise<boolean> {
  const PublicKeyCredentialCtor = window.PublicKeyCredential as typeof PublicKeyCredential & {
    getClientCapabilities?: () => Promise<Record<string, unknown>>
  }

  if (typeof PublicKeyCredentialCtor.getClientCapabilities === 'function') {
    const capabilities = await PublicKeyCredentialCtor.getClientCapabilities()
    if ('prf' in capabilities) return capabilities.prf === true
  }

  // On Apple/WebKit, creating a passkey without a positive PRF signal can leave
  // an orphaned system passkey that this app cannot use to decrypt the vault.
  if (isAppleWebKitWithoutExplicitPrfSignal()) return false

  // Chromium exposed the PRF extension before getClientCapabilities existed.
  return true
}

export function isMissingBiometricCredentialError(error: unknown): boolean {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : String(error ?? '')

  return (
    name === 'NotAllowedError' &&
    /no (?:credentials|passkeys)|not found|not registered|not allowed by the user agent or the platform|no .*matching/i.test(message)
  )
}

export function getBiometricUnavailableMessage(): string {
  return 'Este navegador muestra Face ID como una llave de acceso, pero no permite usarla para desbloquear esta bóveda de forma fiable. Usa Chrome/Edge en escritorio o un navegador compatible con WebAuthn PRF.'
}

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (
      typeof window === 'undefined' ||
      !window.PublicKeyCredential ||
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function'
    ) {
      return false
    }

    const platformAuthenticatorAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    if (!platformAuthenticatorAvailable) return false

    return isWebAuthnPrfAvailable()
  } catch {
    return false
  }
}

export async function registerBiometricCredential(
  masterPassword: string,
  profileId: string,
  userName: string,
  existingCredentialId?: string | null,
): Promise<BiometricBundle> {
  if (!(await isBiometricAvailable())) {
    throw new Error(getBiometricUnavailableMessage())
  }

  const userId = stringToBytes(profileId).slice(0, 16)
  const userIdPadded = new Uint8Array(16)
  userIdPadded.set(userId.slice(0, 16))

  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)

  const excludeCredentials = existingCredentialId
    ? [
        {
          type: 'public-key' as const,
          id: bytesToArrayBuffer(new Uint8Array(base64ToBytes(existingCredentialId))),
          transports: ['internal'] as AuthenticatorTransport[],
        },
      ]
    : undefined
  const rpId = getRpId()

  const createOptions: PublicKeyCredentialCreationOptions = {
    rp: { id: rpId, name: BIOMETRIC_RP_NAME },
    user: {
      id: userIdPadded,
      name: userName,
      displayName: `Contras - ${userName}`,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'required',
    },
    challenge,
    timeout: 60_000,
    attestation: 'none',
    excludeCredentials,
    extensions: {
      prf: {
        eval: { first: BIOMETRIC_PRF_SALT },
      },
    } as any,
  }

  let credential: PublicKeyCredential | null = null
  try {
    credential = await navigator.credentials.create({
      publicKey: createOptions,
    }) as PublicKeyCredential | null
  } catch (error) {
    if (error instanceof DOMException && error.name === 'InvalidStateError') {
      throw new Error('Apple Passwords ya tiene una llave de acceso para Contras en este dispositivo. Usa esa llave para entrar o desactiva la llave local en Ajustes antes de crear una nueva.')
    }
    throw error
  }

  if (!credential) throw new Error('El registro de la llave de acceso local fue cancelado.')

  const extResults = (credential as any).getClientExtensionResults?.() ?? {}
  const prfResult: ArrayBuffer | undefined = extResults?.prf?.results?.first

  if (!prfResult) {
    throw new Error(getBiometricUnavailableMessage())
  }

  const prfKey = await derivePrfKey(new Uint8Array(prfResult))
  const encryptedPassword = await encryptWithPrfKey(masterPassword, prfKey)
  const credentialId = bytesToBase64(new Uint8Array((credential as any).rawId))

  return {
    profileId,
    credentialId,
    encryptedPassword,
    createdAt: new Date().toISOString(),
    discoverable: true,
    rpId,
  }
}

export async function unlockWithBiometrics(bundle: BiometricBundle): Promise<string> {
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)

  const rpId = bundle.rpId || getRpId()
  const credentialIdBytes = new Uint8Array(base64ToBytes(bundle.credentialId))
  const allowCredentials = bundle.discoverable
    ? undefined
    : [
        {
          type: 'public-key' as const,
          id: bytesToArrayBuffer(credentialIdBytes),
          transports: ['internal'] as AuthenticatorTransport[],
        },
      ]

  const getOptions: PublicKeyCredentialRequestOptions = {
    rpId,
    allowCredentials,
    userVerification: 'required',
    challenge,
    timeout: 60_000,
    extensions: {
      prf: {
        eval: { first: BIOMETRIC_PRF_SALT },
      },
    } as any,
  }

  const assertion = await navigator.credentials.get({
    publicKey: getOptions,
    mediation: 'optional',
  }) as PublicKeyCredential | null

  if (!assertion) throw new Error('La autenticacion con la llave de acceso local fue cancelada.')

  const assertionCredentialId = bytesToBase64(new Uint8Array((assertion as any).rawId))
  if (assertionCredentialId !== bundle.credentialId) {
    throw new Error('Has seleccionado otra llave de acceso de Apple Passwords. Elige la llave de Contras guardada para esta bóveda o vuelve a activarla desde Ajustes.')
  }

  const extResults = (assertion as any).getClientExtensionResults?.() ?? {}
  const prfResult: ArrayBuffer | undefined = extResults?.prf?.results?.first

  if (!prfResult) {
    throw new Error('No se pudo derivar la clave de la llave de acceso local. Vuelve a activar el desbloqueo biometrico en este dispositivo.')
  }

  const prfKey = await derivePrfKey(new Uint8Array(prfResult))
  return decryptWithPrfKey(bundle.encryptedPassword, prfKey)
}

async function derivePrfKey(prfBytes: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    bytesToArrayBuffer(prfBytes),
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: bytesToArrayBuffer(stringToBytes('contras-biometric-aes-v1')),
      info: bytesToArrayBuffer(stringToBytes('aes-gcm-key')),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptWithPrfKey(plaintext: string, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bytesToArrayBuffer(iv) },
    key,
    bytesToArrayBuffer(stringToBytes(plaintext)),
  )
  return {
    v: 1,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(data)),
  }
}

async function decryptWithPrfKey(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytesToArrayBuffer(base64ToBytes(payload.iv)) },
    key,
    bytesToArrayBuffer(base64ToBytes(payload.data)),
  )
  return bytesToString(new Uint8Array(plaintext))
}

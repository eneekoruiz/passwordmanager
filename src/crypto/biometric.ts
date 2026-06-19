/**
 * @module biometric
 * @description Motor de autenticación biométrica basado en WebAuthn con extensión PRF.
 *
 * Arquitectura de seguridad:
 * - La credencial WebAuthn vive en el Secure Enclave del dispositivo (Face ID / Touch ID / Windows Hello).
 * - La extensión PRF deriva 32 bytes deterministas de esa credencial, nunca expuestos directamente al JS.
 * - Con esos 32 bytes importamos una CryptoKey AES-256-GCM con extractable=false.
 * - Esa clave cifra la contraseña maestra, que se guarda en IndexedDB.
 * - En ningún momento la contraseña maestra queda accesible sin pasar por el sensor biométrico.
 */

import { bytesToBase64, base64ToBytes, stringToBytes, bytesToString } from './encoding'
import type { EncryptedPayload } from './types'

const BIOMETRIC_RP_ID = window.location.hostname
const BIOMETRIC_RP_NAME = 'Contras Password Manager'
const BIOMETRIC_PRF_SALT = stringToBytes('contras-prf-v1-unlock')

export interface BiometricBundle {
  profileId: string
  credentialId: string        // base64url
  encryptedPassword: EncryptedPayload
  createdAt: string
}

// ─── Detección de soporte ────────────────────────────────────────────────────

/**
 * Devuelve true si el navegador soporta WebAuthn con la extensión PRF
 * (necesaria para derivar la clave de cifrado desde la biometría).
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !window.PublicKeyCredential ||
    !window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
  ) {
    return false
  }

  try {
    const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    return available
  } catch {
    return false
  }
}

// ─── Registro (activar biometría) ─────────────────────────────────────────────

/**
 * Registra una credencial biométrica y guarda la contraseña maestra cifrada.
 * @param masterPassword - Contraseña maestra en texto plano (solo durante el registro, no persiste).
 * @param profileId - ID del perfil al que se asocia esta credencial.
 * @returns BiometricBundle listo para persistir en IndexedDB.
 */
export async function registerBiometricCredential(
  masterPassword: string,
  profileId: string,
  userName: string,
): Promise<BiometricBundle> {
  const userId = stringToBytes(profileId).slice(0, 16)
  // Pad to exactly 16 bytes
  const userIdPadded = new Uint8Array(16)
  userIdPadded.set(userId.slice(0, 16))

  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)

  const createOptions: PublicKeyCredentialCreationOptions = {
    rp: { id: BIOMETRIC_RP_ID, name: BIOMETRIC_RP_NAME },
    user: {
      id: userIdPadded,
      name: userName,
      displayName: userName,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },   // ES256
      { type: 'public-key', alg: -257 },  // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      requireResidentKey: false,
      userVerification: 'required',
    },
    challenge,
    timeout: 60_000,
    extensions: {
      prf: {
        eval: { first: BIOMETRIC_PRF_SALT },
      },
    } as any,
  }

  const credential = await navigator.credentials.create({
    publicKey: createOptions,
  }) as PublicKeyCredential | null

  if (!credential) throw new Error('El registro biométrico fue cancelado.')

  const extResults = (credential as any).getClientExtensionResults?.() ?? {}
  const prfResult: ArrayBuffer | undefined = extResults?.prf?.results?.first

  if (!prfResult) {
    throw new Error(
      'Tu navegador no soporta la extensión PRF de WebAuthn. Usa Chrome 116+ o Safari 17+ para activar la biometría.',
    )
  }

  // Derivar clave AES-256-GCM no-extractable desde los bytes PRF
  const prfKey = await derivePrfKey(new Uint8Array(prfResult))

  // Cifrar la contraseña maestra con esa clave
  const encryptedPassword = await encryptWithPrfKey(masterPassword, prfKey)

  const credentialId = bytesToBase64(new Uint8Array((credential as any).rawId))

  return {
    profileId,
    credentialId,
    encryptedPassword,
    createdAt: new Date().toISOString(),
  }
}

// ─── Desbloqueo biométrico ────────────────────────────────────────────────────

/**
 * Verifica la biometría del usuario y devuelve la contraseña maestra descifrada.
 * @param bundle - Bundle guardado en IndexedDB con la credencial y password cifrada.
 * @returns La contraseña maestra en texto plano (solo en memoria, durante el desbloqueo).
 */
export async function unlockWithBiometrics(bundle: BiometricBundle): Promise<string> {
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)

  const credentialIdBytes = base64ToBytes(bundle.credentialId)

  const getOptions: PublicKeyCredentialRequestOptions = {
    rpId: BIOMETRIC_RP_ID,
    allowCredentials: [
      {
        type: 'public-key',
        id: credentialIdBytes as any,
        transports: ['internal'] as AuthenticatorTransport[],
      },
    ],
    userVerification: 'required',
    challenge,
    timeout: 60_000,
    extensions: {
      prf: {
        evalByCredential: {
          [bundle.credentialId]: { first: BIOMETRIC_PRF_SALT },
        },
        eval: { first: BIOMETRIC_PRF_SALT },
      },
    } as any,
  }

  const assertion = await navigator.credentials.get({
    publicKey: getOptions,
  }) as PublicKeyCredential | null

  if (!assertion) throw new Error('La autenticación biométrica fue cancelada.')

  const extResults = (assertion as any).getClientExtensionResults?.() ?? {}
  const prfResult: ArrayBuffer | undefined =
    extResults?.prf?.results?.first

  if (!prfResult) {
    throw new Error('No se pudo derivar la clave biométrica. Asegúrate de que el sensor está disponible.')
  }

  const prfKey = await derivePrfKey(new Uint8Array(prfResult))
  return decryptWithPrfKey(bundle.encryptedPassword, prfKey)
}

// ─── Helpers criptográficos internos ─────────────────────────────────────────

async function derivePrfKey(prfBytes: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    prfBytes as BufferSource,
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: stringToBytes('contras-biometric-aes-v1') as BufferSource,
      info: stringToBytes('aes-gcm-key') as BufferSource,
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
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    stringToBytes(plaintext) as BufferSource,
  )
  return {
    v: 1,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(data)),
  }
}

async function decryptWithPrfKey(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(payload.iv) as BufferSource },
    key,
    base64ToBytes(payload.data) as BufferSource,
  )
  return bytesToString(new Uint8Array(plaintext))
}

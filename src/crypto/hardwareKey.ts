import {
  base64ToBytes,
  bytesToArrayBuffer,
  bytesToBase64,
  bytesToString,
  stringToBytes,
} from './encoding'
import type { EncryptedPayload } from './types'

const HARDWARE_KEY_RP_ID = window.location.hostname
const HARDWARE_KEY_RP_NAME = 'Contras Password Manager'
const HARDWARE_KEY_PRF_SALT = stringToBytes('contras-prf-v1-hardware-key')

export interface HardwareKeyBundle {
  profileId: string
  credentialId: string        // base64url
  encryptedPassword: EncryptedPayload
  createdAt: string
}

// ─── Detección de soporte ────────────────────────────────────────────────────

/**
 * Devuelve true si el navegador soporta WebAuthn básico.
 */
export async function isHardwareKeyAvailable(): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !window.PublicKeyCredential
  ) {
    return false
  }
  return true
}

// ─── Registro (activar llave física) ──────────────────────────────────────────

/**
 * Registra una credencial de llave física (cross-platform) y guarda la contraseña maestra cifrada.
 * @param masterPassword - Contraseña maestra en texto plano.
 * @param profileId - ID del perfil al que se asocia esta credencial.
 * @returns HardwareKeyBundle listo para persistir en IndexedDB.
 */
export async function registerHardwareKeyCredential(
  masterPassword: string,
  profileId: string,
  userName: string,
): Promise<HardwareKeyBundle> {
  const userId = stringToBytes(profileId).slice(0, 16)
  const userIdPadded = new Uint8Array(16)
  userIdPadded.set(userId.slice(0, 16))

  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)

  const createOptions: PublicKeyCredentialCreationOptions = {
    rp: { id: HARDWARE_KEY_RP_ID, name: HARDWARE_KEY_RP_NAME },
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
      authenticatorAttachment: 'cross-platform', // Obliga a buscar llaves de seguridad USB/NFC
      requireResidentKey: false,
      userVerification: 'required',
    },
    challenge,
    timeout: 60_000,
    extensions: {
      prf: {
        eval: { first: HARDWARE_KEY_PRF_SALT },
      },
    } as any,
  }

  const credential = await navigator.credentials.create({
    publicKey: createOptions,
  }) as PublicKeyCredential | null

  if (!credential) throw new Error('El registro de la llave de seguridad fue cancelado.')

  const extResults = (credential as any).getClientExtensionResults?.() ?? {}
  const prfResult: ArrayBuffer | undefined = extResults?.prf?.results?.first

  if (!prfResult) {
    throw new Error(
      'Tu llave física o navegador no soportan la extensión PRF de WebAuthn. Asegúrate de usar una llave FIDO2 compatible (ej. YubiKey 5) y un navegador moderno en modo seguro (HTTPS).',
    )
  }

  // Derivar clave simétrica AES-256-GCM no extractable
  const prfKey = await deriveHardwarePrfKey(new Uint8Array(prfResult))

  // Cifrar contraseña maestra
  const encryptedPassword = await encryptWithHardwarePrfKey(masterPassword, prfKey)

  const credentialId = bytesToBase64(new Uint8Array((credential as any).rawId))

  return {
    profileId,
    credentialId,
    encryptedPassword,
    createdAt: new Date().toISOString(),
  }
}

// ─── Desbloqueo con llave física ──────────────────────────────────────────────

/**
 * Verifica la llave física y devuelve la contraseña maestra descifrada.
 * @param bundle - Bundle de la llave física guardado en IndexedDB.
 * @returns La contraseña maestra descifrada.
 */
export async function unlockWithHardwareKey(bundle: HardwareKeyBundle): Promise<string> {
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)

  const credentialIdBytes = new Uint8Array(base64ToBytes(bundle.credentialId))

  const getOptions: PublicKeyCredentialRequestOptions = {
    rpId: HARDWARE_KEY_RP_ID,
    allowCredentials: [
      {
        type: 'public-key',
        id: bytesToArrayBuffer(credentialIdBytes),
        transports: ['usb', 'nfc', 'ble', 'hybrid'] as AuthenticatorTransport[],
      },
    ],
    userVerification: 'required',
    challenge,
    timeout: 60_000,
    extensions: {
      prf: {
        eval: { first: HARDWARE_KEY_PRF_SALT },
      },
    } as any,
  }

  const assertion = await navigator.credentials.get({
    publicKey: getOptions,
  }) as PublicKeyCredential | null

  if (!assertion) throw new Error('La autenticación con llave física fue cancelada.')

  const extResults = (assertion as any).getClientExtensionResults?.() ?? {}
  const prfResult: ArrayBuffer | undefined =
    extResults?.prf?.results?.first

  if (!prfResult) {
    throw new Error('No se pudo derivar la clave desde la llave física. Asegúrate de conectar e interactuar con la llave correcta.')
  }

  const prfKey = await deriveHardwarePrfKey(new Uint8Array(prfResult))
  return decryptWithHardwarePrfKey(bundle.encryptedPassword, prfKey)
}

// ─── Helpers criptográficos internos ─────────────────────────────────────────

async function deriveHardwarePrfKey(prfBytes: Uint8Array): Promise<CryptoKey> {
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
      salt: bytesToArrayBuffer(stringToBytes('contras-hardware-key-aes-v1')),
      info: bytesToArrayBuffer(stringToBytes('aes-gcm-key')),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptWithHardwarePrfKey(plaintext: string, key: CryptoKey): Promise<EncryptedPayload> {
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

async function decryptWithHardwarePrfKey(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytesToArrayBuffer(base64ToBytes(payload.iv)) },
    key,
    bytesToArrayBuffer(base64ToBytes(payload.data)),
  )
  return bytesToString(new Uint8Array(plaintext))
}

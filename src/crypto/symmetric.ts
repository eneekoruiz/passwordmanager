import { bytesToString, stringToBytes, bytesToBase64, base64ToBytes, bytesToArrayBuffer } from './encoding'

/**
 * Genera una llave AES-GCM de 256 bits y la devuelve en formato JWK (texto plano base64).
 * Esta llave viajará en la URL (#key) y no en la base de datos.
 */
export async function generateSymmetricLinkKey(): Promise<{ key: CryptoKey; base64Key: string }> {
  const key = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  )
  const exported = await crypto.subtle.exportKey('raw', key)
  const base64Key = bytesToBase64(new Uint8Array(exported))
  return { key, base64Key }
}

/**
 * Importa una llave AES-GCM desde una cadena Base64 cruda.
 */
export async function importSymmetricLinkKey(base64Key: string): Promise<CryptoKey> {
  const rawData = base64ToBytes(base64Key)
  return await crypto.subtle.importKey(
    'raw',
    bytesToArrayBuffer(rawData),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Cifra un texto plano usando una llave AES-GCM.
 * Devuelve un objeto con el IV (en base64) y los datos cifrados (en base64).
 */
export async function encryptForLink(key: CryptoKey, plaintext: string): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encodedText = stringToBytes(plaintext)
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bytesToArrayBuffer(iv) },
    key,
    bytesToArrayBuffer(encodedText)
  )

  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer))
  }
}

/**
 * Descifra datos usando una llave AES-GCM, el IV y el texto cifrado.
 */
export async function decryptForLink(key: CryptoKey, ivBase64: string, ciphertextBase64: string): Promise<string> {
  const iv = base64ToBytes(ivBase64)
  const ciphertext = base64ToBytes(ciphertextBase64)

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytesToArrayBuffer(iv) },
    key,
    bytesToArrayBuffer(ciphertext)
  )

  return bytesToString(new Uint8Array(decryptedBuffer))
}

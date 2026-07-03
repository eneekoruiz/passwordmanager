import { bytesToString, stringToBytes, bytesToBase64, base64ToBytes, bytesToArrayBuffer } from './encoding'

/**
 * Genera un par de llaves RSA-OAEP de 2048 bits para cifrado asimétrico.
 */
export async function generateAsymmetricKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true, // extractable
    ['encrypt', 'decrypt']
  )
}

/**
 * Exporta una llave a formato JWK (JSON Web Key) serializado como string.
 */
export async function exportKeyToJwkString(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key)
  return JSON.stringify(jwk)
}

/**
 * Importa una llave RSA-OAEP desde un string JWK.
 */
export async function importKeyFromJwkString(jwkString: string, type: 'public' | 'private'): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString)
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    type === 'public' ? ['encrypt'] : ['decrypt']
  )
}

/**
 * Cifra un texto plano usando la llave pública del destinatario.
 * Devuelve el texto cifrado en Base64.
 */
export async function encryptWithPublicKey(publicKey: CryptoKey, plaintext: string): Promise<string> {
  const data = stringToBytes(plaintext)
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    bytesToArrayBuffer(data)
  )
  return bytesToBase64(new Uint8Array(encryptedBuffer))
}

/**
 * Descifra un texto en Base64 usando la llave privada.
 */
export async function decryptWithPrivateKey(privateKey: CryptoKey, encryptedBase64: string): Promise<string> {
  const data = base64ToBytes(encryptedBase64)
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    bytesToArrayBuffer(data)
  )
  return bytesToString(new Uint8Array(decryptedBuffer))
}

/**
 * @module hash
 * @description Utilidades para generar hashes consistentes y comparar estados de la bóveda.
 */

/**
 * Genera una representación string consistente (ordenando llaves) para cualquier objeto o array JSON.
 */
export function deterministicStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj)
  }

  if (Array.isArray(obj)) {
    // Si queremos que el orden no importe en listas, tendríamos que ordenarlas.
    // Por simplicidad en la bóveda, asumiremos que preservan el orden, pero si necesitamos
    // ignorar orden, podríamos ordenar por un ID.
    const sortedArr = [...obj].sort((a, b) => {
      if (a && b && typeof a === 'object' && typeof b === 'object') {
        const idA = a.id || a.email || JSON.stringify(a)
        const idB = b.id || b.email || JSON.stringify(b)
        return idA.localeCompare(idB)
      }
      return 0
    })
    return `[${sortedArr.map(deterministicStringify).join(',')}]`
  }

  const keys = Object.keys(obj).sort()
  const strParts = keys.map((key) => {
    // Excluir metadatos volátiles como updatedAt o createdAt para la comparación de contenido
    if (key === 'updatedAt' || key === 'createdAt') {
      return `"${key}":null`
    }
    return `"${key}":${deterministicStringify(obj[key])}`
  })

  return `{${strParts.join(',')}}`
}

/**
 * Genera un Hash SHA-256 (en hex) a partir de un string
 */
export async function generateSha256Hash(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Compara dos estados (local y nube) para determinar si tienen los mismos datos,
 * ignorando campos de timestamp (updatedAt, createdAt).
 */
export async function payloadsAreIdentical(localPayload: any, cloudPayload: any): Promise<boolean> {
  const localStr = deterministicStringify(localPayload)
  const cloudStr = deterministicStringify(cloudPayload)
  
  const localHash = await generateSha256Hash(localStr)
  const cloudHash = await generateSha256Hash(cloudStr)
  
  return localHash === cloudHash
}

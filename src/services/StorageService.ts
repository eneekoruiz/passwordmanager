import { db } from './firebase'
import { doc, getDoc, writeBatch } from 'firebase/firestore'
import { generateId } from '../utils/id'

// Máximo 1 MiB por documento. Usamos 800 KB por chunk por seguridad.
const CHUNK_SIZE = 800 * 1024 

export interface DocumentMetadata {
  id: string
  name: string
  size: number
  mimeType: string
  uploadedAt: string
  chunks: number
}

export class StorageService {
  /**
   * Cifra un archivo en memoria, lo corta en chunks y los sube a Firestore.
   */
  static async uploadDocument(
    userId: string,
    masterKey: CryptoKey,
    file: File
  ): Promise<DocumentMetadata> {
    if (!db) throw new Error('Firestore no está inicializado')

    const fileId = generateId()
    const fileBuffer = await file.arrayBuffer()

    // Encriptación AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      masterKey,
      fileBuffer
    )

    // Unimos IV + Texto Cifrado para almacenar
    const combinedData = new Uint8Array(iv.length + encryptedBuffer.byteLength)
    combinedData.set(iv, 0)
    combinedData.set(new Uint8Array(encryptedBuffer), iv.length)

    // Calculamos chunks
    const totalChunks = Math.ceil(combinedData.length / CHUNK_SIZE)
    const uploadedAt = new Date().toISOString()
    
    const metadata: DocumentMetadata = {
      id: fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      uploadedAt,
      chunks: totalChunks,
    }

    // Subimos los chunks usando Batch para atomicidad (límite de 500 por batch, 500 * 800KB = 400MB, más que suficiente)
    const batch = writeBatch(db)

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, combinedData.length)
      const chunkData = combinedData.slice(start, end)

      const chunkRef = doc(db, `users/${userId}/documentChunks/${fileId}_chunk_${i}`)
      batch.set(chunkRef, {
        data: chunkData,
        index: i,
        fileId: fileId,
      })
    }

    // Guardamos metadata principal
    const docRef = doc(db, `users/${userId}/documents/${fileId}`)
    batch.set(docRef, metadata)

    await batch.commit()

    return metadata
  }

  /**
   * Descarga todos los chunks, los une y los descifra.
   */
  static async downloadDocument(
    userId: string,
    fileId: string,
    masterKey: CryptoKey
  ): Promise<{ blob: Blob; metadata: DocumentMetadata }> {
    if (!db) throw new Error('Firestore no está inicializado')

    const docRef = doc(db, `users/${userId}/documents/${fileId}`)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      throw new Error('El documento no existe en la nube')
    }

    const metadata = docSnap.data() as DocumentMetadata
    const totalChunks = metadata.chunks

    // Descargar todos los chunks (lo hacemos en paralelo para ir más rápido)
    const chunkPromises = []
    for (let i = 0; i < totalChunks; i++) {
      const chunkRef = doc(db, `users/${userId}/documentChunks/${fileId}_chunk_${i}`)
      chunkPromises.push(getDoc(chunkRef))
    }

    const chunkSnaps = await Promise.all(chunkPromises)
    
    // Validar y unir
    let totalLength = 0
    const chunkDataArrays = chunkSnaps.map((snap, idx) => {
      if (!snap.exists()) throw new Error(`Chunk ${idx} faltante`)
      // Firestore guarda los Bytes como Uint8Array internamente gracias a firebase JS SDK
      const data = snap.data().data
      const array = data instanceof Uint8Array ? data : data.toUint8Array()
      totalLength += array.length
      return array
    })

    const combinedData = new Uint8Array(totalLength)
    let offset = 0
    for (const arr of chunkDataArrays) {
      combinedData.set(arr, offset)
      offset += arr.length
    }

    // Desencriptar
    const iv = combinedData.slice(0, 12)
    const ciphertext = combinedData.slice(12)

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      masterKey,
      ciphertext
    )

    const blob = new Blob([decryptedBuffer], { type: metadata.mimeType })

    return {
      blob,
      metadata
    }
  }

  /**
   * Elimina los chunks y los metadatos de Firestore.
   */
  static async deleteDocument(userId: string, fileId: string, chunksCount: number): Promise<void> {
    if (!db) throw new Error('Firestore no está inicializado')
    
    const batch = writeBatch(db)
    
    for (let i = 0; i < chunksCount; i++) {
      const chunkRef = doc(db, `users/${userId}/documentChunks/${fileId}_chunk_${i}`)
      batch.delete(chunkRef)
    }

    const docRef = doc(db, `users/${userId}/documents/${fileId}`)
    batch.delete(docRef)

    await batch.commit()
  }
}

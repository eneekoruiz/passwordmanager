import { useState, useRef } from 'react'
import { useVault } from '../../context/VaultContext'
import { StorageService, type DocumentMetadata } from '../../services/StorageService'
import { useToast } from './ToastProvider'

interface AttachmentsListProps {
  attachments: DocumentMetadata[]
  onAttachmentsChange?: (attachments: DocumentMetadata[]) => void
  readOnly?: boolean
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export function AttachmentsList({ attachments, onAttachmentsChange, readOnly = false }: AttachmentsListProps) {
  const { masterKey, cloudUserId } = useVault()
  const { showToast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!masterKey || !cloudUserId) {
      showToast('Error de autenticación para subir archivos', 'error')
      return
    }

    // Limit to 20MB for practical reasons
    if (file.size > 20 * 1024 * 1024) {
      showToast('El archivo es demasiado grande (Máximo 20 MB)', 'error')
      return
    }

    try {
      setIsUploading(true)
      const metadata = await StorageService.uploadDocument(cloudUserId, masterKey, file)
      onAttachmentsChange?.([...attachments, metadata])
      showToast('Archivo adjuntado correctamente', 'success')
    } catch (error) {
      console.error(error)
      showToast('Error al subir el archivo', 'error')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (attachment: DocumentMetadata) => {
    if (!masterKey || !cloudUserId) return
    if (!window.confirm('¿Seguro que quieres borrar este adjunto de forma permanente?')) return

    try {
      await StorageService.deleteDocument(cloudUserId, attachment.id, attachment.chunks)
      onAttachmentsChange?.(attachments.filter(a => a.id !== attachment.id))
      showToast('Archivo borrado', 'success')
    } catch (error) {
      console.error(error)
      showToast('Error al borrar el archivo', 'error')
    }
  }

  const handleDownloadOrView = async (attachment: DocumentMetadata) => {
    if (!masterKey || !cloudUserId) return
    
    try {
      setDownloadingId(attachment.id)
      const { blob, metadata } = await StorageService.downloadDocument(cloudUserId, attachment.id, masterKey)
      
      const url = URL.createObjectURL(blob)
      
      const isImageOrPdf = metadata.mimeType.startsWith('image/') || metadata.mimeType === 'application/pdf'
      
      if (isImageOrPdf) {
        window.open(url, '_blank')
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = metadata.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
      
      // Cleanup after 60 seconds
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (error) {
      console.error(error)
      showToast('Error al descargar y desencriptar el archivo', 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
          Documentos Adjuntos ({attachments.length})
        </label>
        {!readOnly && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !masterKey || !cloudUserId}
            className="flex h-6 items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 text-[10px] font-bold text-text-secondary transition-all hover:bg-black/10 active:scale-[0.97] disabled:opacity-50"
          >
            {isUploading ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-text-secondary border-t-transparent" />
            ) : (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )}
            <span>{isUploading ? 'Subiendo...' : 'Añadir'}</span>
          </button>
        )}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          // Opcional: accept="image/*,application/pdf"
        />
      </div>

      {attachments.length > 0 ? (
        <ul className="space-y-2">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="group flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2.5 shadow-sm transition-all hover:border-black/10 hover:shadow"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 text-text-tertiary">
                  {attachment.mimeType.startsWith('image/') ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  ) : attachment.mimeType === 'application/pdf' ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5-3h7.5m-7.5-3h7.5m-7.5-3h7.5" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-text-primary">{attachment.name}</p>
                  <p className="text-[10px] text-text-tertiary">{formatBytes(attachment.size)}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleDownloadOrView(attachment)}
                  disabled={downloadingId !== null}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-black/5 active:scale-95 disabled:opacity-50"
                  title="Descargar / Ver"
                >
                  {downloadingId === attachment.id ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-secondary border-t-transparent" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  )}
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleDelete(attachment)}
                    disabled={downloadingId !== null}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 active:scale-95 disabled:opacity-50"
                    title="Eliminar"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex min-h-[64px] items-center justify-center rounded-xl border border-dashed border-black/10 bg-black/[0.01]">
          <span className="text-xs text-text-tertiary">No hay documentos adjuntos</span>
        </div>
      )}
    </div>
  )
}

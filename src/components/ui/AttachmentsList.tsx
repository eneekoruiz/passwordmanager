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

function getMimeIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return '🖼'
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.includes('json')) return '{ }'
  if (mimeType.includes('text')) return '📝'
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '🗜'
  if (mimeType.includes('pem') || mimeType.includes('key') || mimeType.includes('cert')) return '🔑'
  return '📎'
}

export function AttachmentsList({ attachments, onAttachmentsChange, readOnly = false }: AttachmentsListProps) {
  const { masterKey, cloudUserId } = useVault()
  const { showToast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const uploadFile = async (file: File) => {
    if (!masterKey || !cloudUserId) {
      showToast('Error de autenticación para subir archivos', 'error')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast(`"${file.name}" supera el límite de 20 MB`, 'error')
      return
    }
    try {
      setIsUploading(true)
      const metadata = await StorageService.uploadDocument(cloudUserId, masterKey, file)
      onAttachmentsChange?.([...attachments, metadata])
      showToast(`"${file.name}" adjuntado correctamente`, 'success')
    } catch (error) {
      console.error(error)
      showToast(`Error al subir "${file.name}"`, 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    await uploadFile(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
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
      const isViewable = metadata.mimeType.startsWith('image/') || metadata.mimeType === 'application/pdf'
      if (isViewable) {
        window.open(url, '_blank')
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = metadata.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
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
        />
      </div>

      {/* Drop zone — only shown when not read-only */}
      {!readOnly && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-3 text-center transition-all duration-150 select-none ${
            isDragging
              ? 'border-indigo-400 bg-indigo-50 text-indigo-600 scale-[1.01]'
              : 'border-black/10 bg-black/[0.01] text-text-tertiary hover:border-black/20 hover:bg-black/[0.025]'
          }`}
        >
          {isUploading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-text-tertiary border-t-transparent" />
              <span className="text-[11px] font-medium">Subiendo...</span>
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-[11px] font-medium">
                {isDragging ? 'Suelta para adjuntar' : 'Arrastra un archivo o pulsa para seleccionar'}
              </span>
              <span className="text-[10px] text-text-tertiary/70">Máx. 20 MB · Cifrado en la bóveda</span>
            </>
          )}
        </div>
      )}

      {attachments.length > 0 ? (
        <ul className="space-y-2">
          {attachments.map((attachment) => {
            const uploadedAt = (attachment as DocumentMetadata & { uploadedAt?: string }).uploadedAt
            return (
              <li
                key={attachment.id}
                className="group flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2.5 shadow-sm transition-all hover:border-black/10 hover:shadow"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 text-base">
                    {getMimeIcon(attachment.mimeType)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-text-primary">{attachment.name}</p>
                    <p className="text-[10px] text-text-tertiary">
                      {formatBytes(attachment.size)}
                      {uploadedAt && (
                        <span className="ml-2 opacity-70">· {new Date(uploadedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      )}
                    </p>
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
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 active:scale-95 disabled:opacity-50"
                      title="Eliminar"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        readOnly && (
          <div className="flex min-h-[48px] items-center justify-center rounded-xl border border-dashed border-black/10 bg-black/[0.01]">
            <span className="text-xs text-text-tertiary">Sin documentos adjuntos</span>
          </div>
        )
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import type { Account } from '../types'
import { generateId } from '../utils/id'

interface ImportTextModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (parsedRows: Array<{ platformName: string; account: Account }>) => Promise<void>
}

export function ImportTextModal({ isOpen, onClose, onImport }: ImportTextModalProps) {
  const [tsvText, setTsvText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Scrubbing: Limpiar el texto TSV sensible al desmontar
  useEffect(() => {
    return () => {
      setTsvText('')
    }
  }, [])

  if (!isOpen) return null

  const handleProcess = async () => {
    setError(null)
    setSuccess(null)
    const text = tsvText.trim()
    if (!text) {
      setError('Por favor, pega el contenido de la tabla de Google Docs.')
      return
    }

    setLoading(true)
    try {
      const lines = text.split(/\r?\n/)
      const parsedRows: Array<{ platformName: string; account: Account }> = []

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue // Ignorar líneas vacías

        const cols = line.split('\t')
        // Si hay menos de 8 columnas por celdas vacías al final, rellenar
        const paddedCols = [...cols]
        while (paddedCols.length < 8) {
          paddedCols.push('')
        }

        const username = paddedCols[0].trim()
        const birthdate = paddedCols[1].trim()
        const fullName = paddedCols[2].trim()
        const email = paddedCols[3].trim()
        const phone = paddedCols[4].trim()
        const twoFactor = paddedCols[5].trim()
        const password = paddedCols[6].trim()
        const platformName = paddedCols[7].trim()

        // Validaciones requeridas
        if (!platformName) {
          throw new Error(`Fila ${i + 1}: El nombre de la plataforma (columna 8) es obligatorio.`)
        }
        if (!password) {
          throw new Error(`Fila ${i + 1}: La contraseña (columna 7) es obligatoria.`)
        }
        if (!username && !email) {
          throw new Error(`Fila ${i + 1}: Debe indicarse el nombre de usuario (columna 1) o correo electrónico (columna 4).`)
        }

        // Concatenar notas
        const notesParts: string[] = []
        if (birthdate) notesParts.push(`Fecha de nacimiento: ${birthdate}`)
        if (fullName) notesParts.push(`Nombre completo: ${fullName}`)
        if (twoFactor) notesParts.push(`2FA: ${twoFactor}`)
        const notes = notesParts.length > 0 ? notesParts.join('\n') : undefined

        const now = new Date().toISOString()
        const account: Account = {
          id: generateId(),
          username: username,
          email: email,
          password: password,
          phone: phone || undefined,
          notes: notes,
          createdAt: now,
          updatedAt: now,
        }

        parsedRows.push({
          platformName,
          account,
        })
      }

      if (parsedRows.length === 0) {
        throw new Error('No se encontraron filas válidas para importar.')
      }

      await onImport(parsedRows)
      setSuccess(`Importación completada con éxito. Se importaron ${parsedRows.length} cuentas.`)
      setTsvText('')
      setTimeout(() => {
        onClose()
        setSuccess(null)
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Error al procesar el texto. Verifica el formato.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      {/* Click Catcher */}
      <button
        type="button"
        className="fixed inset-0 cursor-default outline-none animate-fade-in"
        onClick={onClose}
        aria-label="Cerrar modal"
      />

      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-black/5 bg-white/80 backdrop-blur-xl p-6 shadow-[0_15px_50px_rgba(0,0,0,0.12)] space-y-4 flex flex-col text-left">
        <header className="flex items-center justify-between border-b border-border-subtle pb-3">
          <h2 className="text-base font-semibold text-text-primary">Importar desde Texto (TSV / Google Docs)</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            aria-label="Cerrar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="space-y-1">
          <p className="text-xs text-text-secondary leading-relaxed">
            Copia una tabla de 8 columnas desde tu Google Docs y pégala a continuación. Las columnas se mapearán automáticamente de izquierda a derecha.
          </p>
          <div className="rounded-lg bg-surface p-3 border border-border-subtle">
            <span className="block text-[10px] font-semibold text-text-tertiary uppercase mb-1">
              Orden esperado de columnas (8 columnas separadas por tabulación):
            </span>
            <code className="text-[10px] text-text-secondary font-mono leading-relaxed block break-words">
              1. Usuario | 2. F. Nacimiento | 3. Nombre Completo | 4. Email | 5. Teléfono | 6. 2FA | 7. Contraseña | 8. Plataforma
            </code>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <textarea
            value={tsvText}
            onChange={(e) => setTsvText(e.target.value)}
            disabled={loading}
            placeholder="Pega las filas de tu tabla aquí..."
            className="w-full min-h-[220px] flex-1 rounded-lg border border-border-subtle bg-surface p-3 text-xs font-mono text-text-primary placeholder:text-text-tertiary outline-none focus:border-border transition-colors resize-y"
          />
        </div>

        {error && <p className="text-xs text-red-600 font-medium" role="alert">{error}</p>}
        {success && <p className="text-xs text-green-600 font-medium" role="alert">{success}</p>}

        <div className="flex justify-end gap-2 border-t border-border-subtle pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleProcess}
            disabled={loading || !tsvText.trim()}
            className="rounded-lg bg-text-primary px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Procesando e importando...' : 'Procesar'}
          </button>
        </div>
      </div>
    </div>
  )
}

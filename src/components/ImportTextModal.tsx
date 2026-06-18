import { useState, useEffect } from 'react'
import type { Platform } from '../types'
import { getFriendlyErrorMessage } from '../utils/errors'
import { createPlatform, LOCAL_IDENTITY_EMAIL } from '../utils/identity'

const IMPORT_COLUMNS = 8

interface ImportTextModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (parsedRows: Array<{ identityEmail: string; platform: Platform }>) => Promise<unknown>
}

interface ImportRow {
  username: string
  birthdate: string
  fullName: string
  email: string
  phone: string
  twoFactor: string
  password: string
  platformName: string
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"' && next === '"') {
      current += '"'
      i++
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === delimiter && !quoted) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

function detectDelimiter(lines: string[]): string | null {
  const candidates = ['\t', ',', ';']
  return (
    candidates.find((delimiter) =>
      lines.some((line) => parseDelimitedLine(line, delimiter).length > 1),
    ) ?? null
  )
}

function rowFromColumns(columns: string[], index: number): ImportRow {
  const padded = [...columns]
  while (padded.length < IMPORT_COLUMNS) padded.push('')

  return {
    username: padded[0]?.trim() ?? '',
    birthdate: padded[1]?.trim() ?? '',
    fullName: padded[2]?.trim() ?? '',
    email: padded[3]?.trim() ?? '',
    phone: padded[4]?.trim() ?? '',
    twoFactor: padded[5]?.trim() ?? '',
    password: padded[6]?.trim() ?? '',
    platformName: padded[7]?.trim() || padded[0]?.trim() || padded[3]?.trim() || `Cuenta importada ${index + 1}`,
  }
}

function normalizeLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function rowFromKeyValueBlock(block: string, index: number): ImportRow | null {
  const values: Record<string, string> = {}

  for (const rawLine of block.split(/\r?\n/)) {
    const match = rawLine.match(/^\s*([^:=-]+)\s*[:=-]\s*(.+?)\s*$/)
    if (!match) continue
    values[normalizeLabel(match[1])] = match[2].trim()
  }

  if (Object.keys(values).length === 0) return null

  return rowFromColumns(
    [
      values.usuario ?? values.username ?? '',
      values.fechanacimiento ?? values.nacimiento ?? values.birthdate ?? '',
      values.nombrecompleto ?? values.fullname ?? values.nombre ?? '',
      values.email ?? values.correo ?? '',
      values.telefono ?? values.phone ?? '',
      values['2fa'] ?? values.twofactor ?? values.twofactorauth ?? '',
      values.contrasena ?? values.password ?? '',
      values.plataforma ?? values.platform ?? values.servicio ?? '',
    ],
    index,
  )
}

function rowFromHeaderMap(headers: string[], columns: string[], index: number): ImportRow {
  const values = headers.reduce<Record<string, string>>((acc, header, headerIndex) => {
    acc[normalizeLabel(header)] = columns[headerIndex]?.trim() ?? ''
    return acc
  }, {})

  return rowFromColumns(
    [
      values.username ?? values.usuario ?? values.user ?? '',
      values.birthdate ?? values.fechanacimiento ?? values.nacimiento ?? '',
      values.fullname ?? values.nombrecompleto ?? values.nameonaccount ?? '',
      values.email ?? values.correo ?? values.identityemail ?? '',
      values.phone ?? values.telefono ?? values.linkedphone ?? '',
      values.twofactor ?? values['2fa'] ?? values.totp ?? values['2faapp'] ?? '',
      values.password ?? values.contrasena ?? '',
      values.platform ?? values.plataforma ?? values.name ?? values.service ?? '',
    ],
    index,
  )
}

function parseImportRows(text: string): ImportRow[] {
  const rawLines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const delimiter = detectDelimiter(rawLines)

  if (delimiter) {
    const parsedLines = rawLines.map((line) => parseDelimitedLine(line, delimiter))
    const maybeHeaders = parsedLines[0] ?? []
    const normalizedHeaders = maybeHeaders.map(normalizeLabel)
    const hasHeader =
      normalizedHeaders.includes('platform') ||
      normalizedHeaders.includes('plataforma') ||
      normalizedHeaders.includes('password') ||
      normalizedHeaders.includes('contrasena')
    if (hasHeader) {
      return parsedLines.slice(1).map((columns, index) => rowFromHeaderMap(maybeHeaders, columns, index))
    }
    return parsedLines.map((columns, index) => rowFromColumns(columns, index))
  }

  const keyValueRows = text
    .split(/\r?\n\s*\r?\n/)
    .map((block, index) => rowFromKeyValueBlock(block, index))
    .filter((row): row is ImportRow => row !== null)

  if (keyValueRows.length > 0) return keyValueRows

  const rows: ImportRow[] = []
  for (let i = 0; i < rawLines.length; i += IMPORT_COLUMNS) {
    rows.push(rowFromColumns(rawLines.slice(i, i + IMPORT_COLUMNS), rows.length))
  }
  return rows
}

export function ImportTextModal({ isOpen, onClose, onImport }: ImportTextModalProps) {
  const [tsvText, setTsvText] = useState('')
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
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
      const rows = parseImportRows(text)
      const parsedRows: Array<{ identityEmail: string; platform: Platform }> = []

      for (const row of rows) {
        const username = row.username
        const birthdate = row.birthdate
        const fullName = row.fullName
        const email = row.email
        const phone = row.phone
        const twoFactor = row.twoFactor
        const password = row.password
        const platformName = row.platformName
        const identityEmail = email || LOCAL_IDENTITY_EMAIL
        const hasGoogleSso = /google|sso/i.test(`${twoFactor} ${platformName}`)

        const platform = createPlatform(platformName, {
          username: username || email,
          fullName: fullName || null,
          birthDate: birthdate || null,
          linkedPhone: phone || null,
          twoFactorAuth: twoFactor || null,
          accessMethods: [
            ...(password ? [{ id: crypto.randomUUID(), type: 'PASSWORD' as const, password }] : []),
            ...(hasGoogleSso
              ? [{
                  id: crypto.randomUUID(),
                  type: 'SSO' as const,
                  provider: 'Google' as const,
                  email: email || null,
                }]
              : []),
          ],
          hardwareKey: /yubikey|hardware|llave/i.test(twoFactor),
          apiKeys: [],
        })

        parsedRows.push({
          identityEmail,
          platform,
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
    } catch (error) {
      setError(getFriendlyErrorMessage(error, 'Error al procesar el texto. Verifica el formato.'))
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setSuccess(null)
    if (!/\.csv$/i.test(file.name)) {
      setError('Selecciona un archivo .csv exportado desde Excel.')
      return
    }

    try {
      const text = await file.text()
      setTsvText(text)
      setSelectedFileName(file.name)
      setSuccess(`Archivo "${file.name}" cargado. Revisa el contenido y pulsa Procesar.`)
    } catch (error) {
      setError(getFriendlyErrorMessage(error, 'No se pudo leer el archivo CSV.'))
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
          <h2 className="text-base font-semibold text-text-primary">Importar desde texto inteligente</h2>
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
            Pega una tabla TSV, CSV o texto copiado desde móvil. Si faltan columnas, se rellenarán como vacías sin detener la importación.
          </p>
          <div className="rounded-lg bg-surface p-3 border border-border-subtle">
            <span className="block text-[10px] font-semibold text-text-tertiary uppercase mb-1">
              Orden recomendado de columnas:
            </span>
            <code className="text-[10px] text-text-secondary font-mono leading-relaxed block break-words">
              1. Usuario | 2. F. Nacimiento | 3. Nombre Completo | 4. Email | 5. Teléfono | 6. 2FA | 7. Contraseña | 8. Plataforma
            </code>
          </div>
          <label className="mt-3 flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 text-xs font-semibold text-text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-surface-hover">
            <span className="truncate">{selectedFileName ?? 'Cargar archivo CSV desde Excel'}</span>
            <span className="rounded-lg bg-surface px-2 py-1 text-[10px] font-bold text-text-secondary">.CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => void handleFileUpload(event.target.files?.[0])}
            />
          </label>
        </div>

        <div className="flex-1 flex flex-col">
          <textarea
            value={tsvText}
            onChange={(e) => setTsvText(e.target.value)}
            disabled={loading}
            placeholder="Pega las filas de tu tabla aquí..."
            className="w-full min-h-[220px] flex-1 rounded-lg border border-border-subtle bg-surface p-3 text-base font-mono text-text-primary placeholder:text-text-tertiary outline-none focus:border-border transition-colors resize-y"
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

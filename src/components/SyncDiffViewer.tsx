import type { SyncDiffResult, VaultDiffItem } from '../types'
import { useState } from 'react'

interface SyncDiffViewerProps {
  diffResult: SyncDiffResult
  onConfirm: () => void
  onCancel: () => void
  isDownloading?: boolean
}

export function SyncDiffViewer({ diffResult, onConfirm, onCancel, isDownloading = false }: SyncDiffViewerProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'added' | 'modified' | 'deleted'>('all')

  const filteredDiffs = diffResult.diffs.filter((diff) => activeTab === 'all' || diff.status === activeTab)

  const addedCount = diffResult.diffs.filter((d) => d.status === 'added').length
  const modifiedCount = diffResult.diffs.filter((d) => d.status === 'modified').length
  const deletedCount = diffResult.diffs.filter((d) => d.status === 'deleted').length

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex h-full max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-text-primary">Resolución de Sincronización</h2>
            <p className="mt-1 text-sm text-text-secondary">
              La nube contiene cambios. Revisa las diferencias antes de descargar.
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </div>
        </div>

        <div className="flex gap-2 border-b border-border bg-surface px-6 pt-3">
          <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')} label="Todos" count={diffResult.diffs.length} />
          <TabButton active={activeTab === 'added'} onClick={() => setActiveTab('added')} label="Nuevos en Nube" count={addedCount} color="text-green-600" bg="bg-green-100" />
          <TabButton active={activeTab === 'modified'} onClick={() => setActiveTab('modified')} label="Modificados" count={modifiedCount} color="text-amber-600" bg="bg-amber-100" />
          <TabButton active={activeTab === 'deleted'} onClick={() => setActiveTab('deleted')} label="Solo Locales" count={deletedCount} color="text-red-600" bg="bg-red-100" />
        </div>

        <div className="flex-1 overflow-y-auto bg-surface-subtle p-6">
          {filteredDiffs.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm font-medium text-text-tertiary">No hay elementos en esta categoría.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredDiffs.map((diff) => (
                <DiffItemRow key={diff.id} item={diff} />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-surface px-6 py-4">
          <p className="text-xs text-text-tertiary">
            Al aceptar, tu bóveda local será reemplazada por la versión de la nube.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isDownloading}
              className="rounded-xl border border-black/5 bg-surface px-5 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDownloading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-60"
            >
              {isDownloading ? (
                <>Descargando...</>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Sobrescribir Local
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, label, count, color = 'text-text-primary', bg = 'bg-black/5' }: any) {
  return (
    <button
      onClick={onClick}
      className={`relative border-b-2 px-4 pb-3 pt-2 text-sm font-bold transition-colors ${
        active ? 'border-blue-600 text-blue-700' : 'border-transparent text-text-secondary hover:text-text-primary'
      }`}
    >
      <div className="flex items-center gap-2">
        {label}
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? 'bg-blue-100 text-blue-700' : `${bg} ${color}`}`}>
          {count}
        </span>
      </div>
    </button>
  )
}

function DiffItemRow({ item }: { item: VaultDiffItem }) {
  const statusConfig = {
    added: { icon: '+', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', label: 'Nuevo en nube' },
    modified: { icon: '±', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', label: 'Diferente' },
    deleted: { icon: '-', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', label: 'Solo local' },
    conflict: { icon: '!', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', label: 'Conflicto' },
  }[item.status]

  return (
    <div className={`flex items-center justify-between rounded-2xl border bg-white p-4 transition-all hover:shadow-subtle ${statusConfig.border}`}>
      <div className="flex items-center gap-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold ${statusConfig.bg} ${statusConfig.color}`}>
          {statusConfig.icon}
        </div>
        <div>
          <h4 className="text-sm font-bold text-text-primary">{item.title}</h4>
          <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            <span>{item.type.replace('_', ' ')}</span>
            <span className="h-1 w-1 rounded-full bg-border"></span>
            <span className={`${statusConfig.color}`}>{statusConfig.label}</span>
          </div>
        </div>
      </div>
      <div className="text-right text-xs text-text-tertiary">
        {item.cloudUpdatedAt && <p>Nube: {new Date(item.cloudUpdatedAt).toLocaleString()}</p>}
        {item.localUpdatedAt && <p>Local: {new Date(item.localUpdatedAt).toLocaleString()}</p>}
      </div>
    </div>
  )
}

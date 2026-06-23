import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  isChunkError: boolean
}

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return (
    /failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /chunkloaderror/i.test(message) ||
    /loading chunk [\d]+ failed/i.test(message)
  )
}

function reloadOnceForChunkFailure(): void {
  if (typeof window === 'undefined') return
  const key = 'contras.chunk-reload-attempted'
  if (window.sessionStorage.getItem(key) === '1') return
  window.sessionStorage.setItem(key, '1')
  const url = new URL(window.location.href)
  url.searchParams.set('v', Date.now().toString())
  window.location.replace(url.toString())
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    isChunkError: false,
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, isChunkError: isChunkLoadError(error) }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Root ErrorBoundary caught an error:', error, errorInfo)
    if (isChunkLoadError(error)) {
      reloadOnceForChunkFailure()
    }
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 font-sans text-center">
          <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-6 shadow-lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600 mx-auto mb-4">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900">Algo ha salido mal</h2>
            <p className="mt-2 text-xs text-slate-500">
              {this.state.isChunkError
                ? 'La app acaba de actualizarse y Safari conservó un módulo antiguo. Recarga para tomar la versión nueva.'
                : 'Se ha producido un error inesperado al renderizar la interfaz. Por favor, recarga la aplicación.'}
            </p>
            {this.state.error && (
              <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-left text-[10px] font-mono text-slate-600">
                {this.state.error.toString()}
              </pre>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 min-h-11 w-full rounded-xl bg-slate-900 text-xs font-bold text-white transition-all hover:bg-slate-800"
            >
              Recargar aplicación
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

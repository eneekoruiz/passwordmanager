import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { logUnexpectedError } from './utils/errors'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/ui/ToastProvider'

// Manejador global para detectar errores de carga de chunks dinámicos (post-despliegue)
if (typeof window !== 'undefined') {
  const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
    const error = 'reason' in event ? event.reason : event.error
    if (!error) return
    
    const errorMessage = String(error.message || error)
    const isChunkError = 
      /failed to fetch dynamically imported module/i.test(errorMessage) ||
      /error loading dynamically imported module/i.test(errorMessage) ||
      errorMessage.includes('ChunkLoadError')
      
    if (isChunkError) {
      console.warn('Chunk load error detected. Reloading page to clear cache...', error)
      const key = 'contras.chunk-reload-attempted'
      if (window.sessionStorage.getItem(key) !== '1') {
        window.sessionStorage.setItem(key, '1')
        const url = new URL(window.location.href)
        url.searchParams.set('v', Date.now().toString())
        window.location.replace(url.toString())
      }
    }
  }

  window.addEventListener('error', handleChunkError, true)
  window.addEventListener('unhandledrejection', handleChunkError)
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('No se encontro el contenedor principal de la aplicacion.')
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
)

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const registerSW = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => logUnexpectedError('Error al registrar Service Worker', error))
  }

  if (document.readyState === 'complete') {
    registerSW()
  } else {
    window.addEventListener('load', registerSW, { once: true })
  }

// Interceptar errores globales de carga de chunks (módulos dinámicos)
// para forzar recarga cuando hay un despliegue nuevo y el cliente PWA tiene un hash antiguo.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const isChunkLoadError = 
      event.reason &&
      (event.reason.name === 'ChunkLoadError' ||
      /failed to fetch dynamically imported module/i.test(event.reason.message) ||
      /loading chunk/i.test(event.reason.message))
      
    if (isChunkLoadError) {
      console.warn('Chunk load error (PWA version mismatch). Force reloading...')
      event.preventDefault()
      window.location.reload()
    }
  })

  // Evento específico de Vite
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('Vite preload error. Force reloading...')
    event.preventDefault()
    window.location.reload()
  })
}

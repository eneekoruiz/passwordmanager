import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { logUnexpectedError } from './utils/errors'

import { ToastProvider } from './components/ui/ToastProvider'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('No se encontro el contenedor principal de la aplicacion.')
}

createRoot(rootElement).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
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
}


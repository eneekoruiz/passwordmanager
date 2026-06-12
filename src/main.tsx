import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

if ('serviceWorker' in navigator) {
  const registerSW = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('Service Worker registrado con éxito:', reg.scope))
      .catch((err) => console.error('Error al registrar Service Worker:', err))
  }

  if (document.readyState === 'complete') {
    registerSW()
  } else {
    window.addEventListener('load', registerSW)
  }
}


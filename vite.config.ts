import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar el SDK de Firebase en su propio chunk para mejor caching.
          // El navegador solo re-descarga este chunk si cambia la versión de Firebase.
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          // Separar React en su propio chunk
          'vendor-react': ['react', 'react-dom'],
        },
      },
    },
  },
})



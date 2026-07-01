import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/__/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(?:logo\.clearbit\.com|t3\.gstatic\.com|icons\.duckduckgo\.com|www\.google\.com)\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'platform-logos',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    })
  ],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-firebase-app': ['firebase/app'],
          'vendor-firebase-auth': ['firebase/auth'],
          'vendor-firebase-firestore': ['firebase/firestore']
        },
      },
    },
  },
})

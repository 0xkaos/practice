import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  publicDir: 'narakeet_audio',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/@firebase/firestore/') || id.includes('/firebase/firestore/')) return 'firebase-store'
          if (id.includes('/@firebase/auth/') || id.includes('/firebase/auth/')) return 'firebase-auth'
          if (id.includes('/@firebase/') || id.includes('/firebase/')) return 'firebase-core'
          if (id.includes('/node_modules/')) return 'vendor'
          if (id.endsWith('/data/sentences.json')) return 'sentences'
        },
      },
    },
  },
})

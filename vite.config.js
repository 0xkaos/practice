import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Expose only this specific browser key, never the rest of the environment.
  const firebaseApiKey = (process.env.VITE_FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY || process.env.APIKEY || '').trim()
  if (command === 'build' && !firebaseApiKey) {
    throw new Error('Missing Firebase browser key. Set the Actions repository secret APIKEY for Pages, or VITE_FIREBASE_API_KEY in .env.local for local builds.')
  }
  return {
    define: { 'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(firebaseApiKey) },
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
  }
})

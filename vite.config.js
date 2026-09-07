import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/practice/',
  plugins: [react()],
  publicDir: 'narakeet_audio',
})

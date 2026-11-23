import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // works on Firebase Hosting and GitHub Pages
  build: { chunkSizeWarningLimit: 1600 },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// For GitHub Pages: set BASE_PATH to your repo name, e.g. BASE_PATH=/splunk-architect-design/
const base = (typeof process.env.BASE_PATH === 'string' && process.env.BASE_PATH) || '/'

export default defineConfig({
  base,
  plugins: [react()],
})

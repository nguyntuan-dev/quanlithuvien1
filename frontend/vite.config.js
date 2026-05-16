import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const localApiTarget = process.env.VITE_DEV_API_URL || 'http://127.0.0.1:8000'
const isPreview = process.argv.includes('preview')

export default defineConfig(({ command }) => ({
  plugins: [react()],
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 4173,
    allowedHosts: ['.up.railway.app', 'quanlithuvien.live'],
  },
  server: {
    port: 5173,
    ...(command === 'serve' && !isPreview
      ? {
          proxy: {
            '/api': {
              target: localApiTarget,
              changeOrigin: true,
            },
          },
        }
      : {}),
  },
}))

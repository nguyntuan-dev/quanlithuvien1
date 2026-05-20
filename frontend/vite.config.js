import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const localApiTarget = process.env.VITE_DEV_API_URL || 'http://127.0.0.1:8000'
const isPreview = process.argv.includes('preview')
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://quanlithuvien1-production.up.railway.app",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
}

export default defineConfig(({ command }) => ({
  plugins: [react()],
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 4173,
    allowedHosts: ['.up.railway.app', 'quanlithuvien.live'],
    headers: securityHeaders,
  },
  server: {
    port: 5173,
    headers: securityHeaders,
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

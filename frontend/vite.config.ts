import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true }
    }
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // Chunks separados para mejor caché
        manualChunks: {
          vendor:   ['react', 'react-dom', 'react-router-dom'],
          charts:   ['recharts'],
          query:    ['@tanstack/react-query'],
          utils:    ['date-fns', 'zustand', 'axios'],
        }
      }
    }
  },
  // En producción, VITE_API_URL apunta al backend de Railway
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || '')
  }
}))

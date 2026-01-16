import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy API requests to deployed Vercel app during local development
      '/api': {
        target: 'https://mcsb-oracle.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})

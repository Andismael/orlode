import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  envDir: '..',
  optimizeDeps: {
    exclude: ['face-api.js'],
  }, // .env is at corpmind-ai/ root, not client/
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom', 'zustand'],
  },
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://corpmind-server-mkorkoxm2a-ew.a.run.app',
        changeOrigin: true,
        secure: true,
      },
      '/socket.io': {
        target: 'https://corpmind-server-mkorkoxm2a-ew.a.run.app',
        changeOrigin: true,
        secure: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'ui-vendor': ['framer-motion', 'lucide-react'],
          'charts-vendor': ['recharts'],
          'pdf-vendor': ['jspdf', 'jspdf-autotable'],
          'face-vendor': ['face-api.js'],
          'three-vendor': ['three'],
          'date-vendor': ['date-fns'],
          'http-vendor': ['axios'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});

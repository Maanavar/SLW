import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

function readBackendPort() {
  const envFiles = ['backend/.env', 'backend/.env.example'];

  for (const envFile of envFiles) {
    const envPath = path.resolve(__dirname, envFile);
    if (!fs.existsSync(envPath)) {
      continue;
    }

    const match = fs.readFileSync(envPath, 'utf8').match(/^\s*PORT\s*=\s*(\d+)\s*$/m);
    if (match) {
      return match[1];
    }
  }

  return '3001';
}

const backendPort = readBackendPort();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    open: true,
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
          charts: ['recharts'],
          excel: ['exceljs'],
          exportPdf: ['jspdf', 'jspdf-autotable', 'html-to-image'],
        },
      },
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Vite config for Electron renderer process (React SPA)
export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer'),
    },
  },
});

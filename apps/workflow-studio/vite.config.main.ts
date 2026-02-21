import { defineConfig } from 'vite';
import { resolve } from 'path';

// Vite config for Electron main process
export default defineConfig({
  build: {
    outDir: 'dist/main',
    lib: {
      entry: resolve(__dirname, 'src/main/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'electron',
        'path',
        'fs',
        'os',
        'url',
        'child_process',
        'events',
        'stream',
        'util',
        'crypto',
        'http',
        'https',
        'net',
        'tls',
        'zlib',
        'buffer',
      ],
      output: {
        entryFileNames: 'index.js',
      },
    },
    minify: false,
    sourcemap: true,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
    },
  },
});

import { defineConfig } from 'vite';
import { resolve } from 'path';
import { builtinModules } from 'module';

// Vite config for Electron preload script
export default defineConfig({
  build: {
    outDir: 'dist/preload',
    lib: {
      entry: resolve(__dirname, 'src/preload/preload.ts'),
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: {
        entryFileNames: 'preload.js',
      },
    },
    minify: false,
    sourcemap: true,
    emptyOutDir: true,
  },
});

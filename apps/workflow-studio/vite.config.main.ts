import { defineConfig } from 'vite';
import { resolve } from 'path';
import { builtinModules } from 'module';

// Vite config for Electron main process
export default defineConfig({
  build: {
    outDir: resolve(__dirname, 'dist/main'),
    lib: {
      entry: resolve(__dirname, 'src/main/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      // Use a function so bare specifiers AND resolved file paths are both caught.
      // Vite resolves imports to full paths before Rollup sees them, so a plain
      // string array won't match resolved paths for native addons.
      external: (id: string) => {
        // Native addons — must never be bundled
        const nativePackages = ['node-pty', 'ioredis'];
        if (nativePackages.some((pkg) => id === pkg || id.startsWith(pkg + '/') || id.includes(`/node_modules/${pkg}/`))) {
          return true;
        }
        // Electron and Node built-ins
        if (id === 'electron') return true;
        const bare = id.replace(/^node:/, '');
        if (builtinModules.includes(bare)) return true;
        if (builtinModules.includes(id)) return true;
        return false;
      },
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

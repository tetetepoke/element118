import { defineConfig } from 'vite';

// GitHub Pages: https://tetetepoke.github.io/element118/
export default defineConfig({
  base: '/element118/',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  server: { host: true },
});

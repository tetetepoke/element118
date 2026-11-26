import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// GitHub Pages: https://tetetepoke.github.io/element118/
export default defineConfig({
  base: '/element118/',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
    // separate pages: the 2D game (index.html), the 3D prototype (3d/) and the 3D chapter 1 game (chapter1/)
    rollupOptions: {
      // the one-file 2D build (scripts/build-single-html.py) sets E118_SINGLE and leaves the 3D page out
      input: process.env.E118_SINGLE
        ? { main: resolve(__dirname, 'index.html') }
        : { main: resolve(__dirname, 'index.html'), proto3d: resolve(__dirname, '3d/index.html'), chapter1: resolve(__dirname, 'chapter1/index.html') },
    },
  },
  server: { host: true },
});

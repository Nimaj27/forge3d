/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Configuration Vite + Vitest de Forge3D.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'Forge3D',
        short_name: 'Forge3D',
        description: 'Créer des fichiers STL imprimables en 3D, sur ordinateur et sur téléphone.',
        lang: 'fr',
        dir: 'ltr',
        start_url: '/modeles',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#121316',
        theme_color: '#121316',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // tout le nécessaire hors ligne : application, worker, moteur WASM, polices, icônes
        globPatterns: ['**/*.{js,css,html,wasm,ttf,woff2,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/__\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // manifold-3d charge son .wasm lui-même : on évite le pré-bundling.
    exclude: ['manifold-3d'],
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'shared/**/*.test.ts'],
    testTimeout: 60_000,
  },
});

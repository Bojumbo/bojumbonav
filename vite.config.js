import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Use the static manifest.webmanifest from public/ — do NOT let the plugin
      // generate its own (it produces an invalid file in dev mode)
      manifest: false,
      manifestFilename: 'manifest.webmanifest',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'favicon.svg', 'manifest.webmanifest'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*arcgisonline\.com\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'esri-dark-tiles',
              expiration: {
                maxEntries: 2000,
                maxAgeSeconds: 30 * 24 * 60 * 60
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*tile\.openstreetmap\.org\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: {
                maxEntries: 2000,
                maxAgeSeconds: 30 * 24 * 60 * 60
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  // Prevent Vite from pre-bundling maplibre-gl which uses a Web Worker internally
  optimizeDeps: {
    exclude: ['maplibre-gl']
  }
});


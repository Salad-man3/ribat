import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // SYNC-04: the shell is cached so class mode opens offline; /api is never cached —
      // domain data lives in Dexie, where code decides what is stale.
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [{ urlPattern: /\/api\//, handler: 'NetworkOnly' }],
      },
      manifest: {
        name: 'Ribat',
        short_name: 'Ribat',
        description: 'Mosque education operations',
        theme_color: '#0a4a2b',
        background_color: '#0a4a2b',
        display: 'standalone',
        start_url: '/',
        lang: 'ar',
        dir: 'rtl',
        icons: [
          {
            src: '/vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
        ],
      },
    }),
  ],
  // @ribat/shared and @ribat/quran-data build to CommonJS. Pre-bundling converts them so
  // class mode can run the same Zod schemas and Quran maths offline (SYNC-07).
  optimizeDeps: { include: ['@ribat/shared', '@ribat/quran-data'] },
  build: {
    commonjsOptions: { include: [/packages\/(shared|quran-data)\//, /node_modules/] },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});

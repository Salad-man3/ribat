import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, '../..');
const quranDataEntry = path.resolve(repoRoot, 'packages/quran-data/src/index.ts');

export default defineConfig({
  resolve: {
    alias: {
      // tsc only sees the ambient module. Demo builds override this with the real client.
      '@demo/client': path.resolve(root, 'src/api/demo-client-stub.ts'),
      // CJS dist breaks named exports in optimizeDeps; compile workspace source as ESM.
      '@ribat/quran-data': quranDataEntry,
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // SYNC-04: the shell is cached so class mode opens offline; /api is never cached —
      // domain data lives in Dexie, where code decides what is stale.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/\.well-known\//],
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
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  // @ribat/shared and @ribat/quran-data build to CommonJS. Pre-bundling converts them so
  // class mode can run the same Zod schemas and Quran maths offline (SYNC-07).
  optimizeDeps: { include: ['@ribat/shared'], exclude: ['@ribat/quran-data'] },
  build: {
    commonjsOptions: { include: [/packages\/(shared|quran-data)\//, /node_modules/] },
  },
  server: {
    fs: { allow: [repoRoot] },
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res.writeHead && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'API is not reachable yet',
                  },
                }),
              );
            }
          });
        },
      },
    },
  },
});

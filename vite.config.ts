import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    // Keep the AudioWorklet a real file: a data: URL would need a looser CSP.
    assetsInlineLimit: (file) => (file.endsWith('.js') ? false : undefined),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Whitenoise',
        short_name: 'Whitenoise',
        theme_color: '#0e0e0d',
        background_color: '#0e0e0d',
        id: '/',
        scope: '/',
        display: 'standalone',
        start_url: '/',
        description:
          'Free white, pink, brown, green and blue noise plus calming nature sounds, generated live in your browser.',
        categories: ['lifestyle', 'productivity'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallbackDenylist: [/^\/healthz/, /^\/sounds\//],
        runtimeCaching: [
          {
            // Nature recordings are large, so they are cached the first time they play
            // rather than precached on install.
            // manifest.json is left to the network so newly added recordings show up.
            urlPattern: ({ url }) => url.pathname.startsWith('/sounds/') && !url.pathname.endsWith('.json'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'sounds',
              expiration: { maxEntries: 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
});

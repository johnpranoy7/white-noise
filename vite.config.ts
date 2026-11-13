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
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Whitenoise',
        short_name: 'Whitenoise',
        description: 'Noise and nature sounds for focus and sleep.',
        theme_color: '#0f1420',
        background_color: '#0f1420',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
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

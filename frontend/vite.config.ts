import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'offline.html', 'icons/*.png'],
      manifest: {
        name: 'Blood Donation and Emergency Response Platform',
        short_name: 'BloodSOS',
        description:
          'A digital platform for blood donation, emergency blood requests, donor coordination and hospital blood management.',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#c8102e',
        background_color: '#0f172a',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/auth\//,
          /^\/inventory\//,
          /^\/blood-requests\//,
          /^\/appointments\//,
          /^\/notifications\//,
          /^\/donors\//,
          /^\/hospitals\//,
          /^\/donor-clinical-records\//,
          /^\/reports\//,
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              [
                '/auth',
                '/inventory',
                '/blood-requests',
                '/appointments',
                '/notifications',
                '/donors',
                '/hospitals',
                '/donor-clinical-records',
                '/reports',
                '/sms',
                '/users',
                '/admin-dashboard',
              ].some((path) => url.pathname.startsWith(path)),
            handler: 'NetworkOnly',
            method: 'GET',
          },
          {
            urlPattern: ({ request, url }) =>
              request.method === 'GET' &&
              !url.pathname.startsWith('/api/') &&
              /\.(?:png|svg|css|js|woff2)$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'bloodsos-static-assets',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});

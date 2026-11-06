import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // l'utilisateur choisit quand mettre à jour : voir src/MiseAJour.jsx
      injectRegister: false, // enregistré dans src/pwa.js
      manifest: {
        id: '/',
        name: 'Voltra',
        short_name: 'Voltra',
        description: 'Ta prépa physique sur mesure : un programme créé par l\'IA pour ton sport et un coach à chaque séance.',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        theme_color: '#9BE84F',
        background_color: '#F5F5F7',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff,woff2}'],
        globIgnores: ['icons.svg'],
        navigateFallback: 'index.html',
        // Un lien d'invitation charge toujours la dernière version : une ancienne en cache ne saurait pas le lire
        navigateFallbackDenylist: [/[?&]invitation=/],
        cleanupOutdatedCaches: true,
        // Seules les requêtes GET passent par ces règles. Les autres (POST, PATCH, DELETE) n'ont
        // aucune règle : le service worker ne les touche pas et elles vont droit au réseau.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'polices-css', cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'polices',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // Tout le reste hors du site (Supabase, Stripe, APIs) : réseau uniquement, jamais de cache
          {
            urlPattern: ({ url }) => url.origin !== self.location.origin,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})

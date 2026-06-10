import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      // favicon.ico removed from includeAssets — file does not exist in public/.
      // exotiq-logo.png is a text stub; a real PNG needs a design/Lovable handoff (see FD-03 note).
      includeAssets: ['robots.txt', 'brand/logos/svg/d-emblem-gulf-blue-transparent.svg'],
      manifest: {
        name: 'Exotiq Fleet Management',
        short_name: 'Exotiq',
        description: 'Luxury fleet management platform with AI-powered insights',
        theme_color: '#2596BE',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/brand/logos/svg/d-emblem-gulf-blue-transparent.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/brand/logos/svg/d-emblem-gulf-blue-transparent.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // CRITICAL: Do NOT cache HTML - prevents stale index.html after deploys
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MiB
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: null, // Disable navigateFallback entirely
        runtimeCaching: [
          // Navigation requests - NetworkOnly to NEVER serve stale HTML
          // This is the #1 fix for "stale app after deploy" issues
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkOnly',
          },
          // ONLY cache public storage assets (images), NOT API calls
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-public-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days for static images
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

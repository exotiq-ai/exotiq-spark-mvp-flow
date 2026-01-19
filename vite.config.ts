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
      includeAssets: ['favicon.ico', 'robots.txt', 'exotiq-logo.png'],
      manifest: {
        name: 'Exotiq Fleet Management',
        short_name: 'Exotiq',
        description: 'Luxury fleet management platform with AI-powered insights',
        theme_color: '#2596BE',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/exotiq-logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6 MiB
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Use NetworkFirst for navigation to reduce stale HTML issues
        navigateFallback: null, // Disable navigateFallback to avoid serving stale index.html
        runtimeCaching: [
          // Navigation requests - always go to network first
          // This prevents stale HTML from being served after deployments
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'navigation-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 5 // 5 minutes max for HTML
              }
            }
          },
          // ONLY cache public storage assets (images), NOT API calls
          // API caching caused stale data issues after deployments
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

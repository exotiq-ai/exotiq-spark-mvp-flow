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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — kept together for a single tight vendor chunk
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/') ||
            id.includes('node_modules/react-router/')
          ) {
            return 'react-vendor';
          }
          // Recharts charting library
          if (id.includes('node_modules/recharts/')) {
            return 'charts';
          }
          // Radix UI primitives
          if (id.includes('node_modules/@radix-ui/')) {
            return 'ui-vendor';
          }
          // xlsx and framer-motion fall into their own lazy chunks naturally
        },
      },
    },
  },
}));

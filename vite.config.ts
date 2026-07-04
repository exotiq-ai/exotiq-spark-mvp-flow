import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    // Stamped into the bundle so the console shows which build is running.
    // Used by main.tsx to log `[Exotiq] build <id>` on boot.
    __BUILD_ID__: JSON.stringify(
      process.env.LOVABLE_BUILD_ID ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.COMMIT_REF ||
        new Date().toISOString(),
    ),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'robots.txt',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'og-image.jpg',
        'brand/logos/svg/d-emblem-gulf-blue-transparent.svg',
        'brand/logos/svg/d-emblem-white-transparent.svg',
      ],
      manifest: {
        name: 'Exotiq — Luxury Fleet Management',
        short_name: 'Exotiq',
        description: 'AI-powered fleet management platform for luxury and exotic car rental operators.',
        theme_color: '#0B3D91',
        background_color: '#0B3D91',
        display: 'standalone',
        icons: [
          { src: '/notification-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
          // Recharts intentionally NOT split — isolating it from react-vendor
          // caused a "Cannot read properties of undefined (reading 'forwardRef')"
          // crash on boot. Let Rollup co-locate it with its React interop shim.
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

import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from 'vite-plugin-pwa';


// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === "development" ? "/" : process.env.VITE_BASE_PATH || "/",
  optimizeDeps: {
    entries: ["src/main.tsx", "src/tempobook/**/*"],
    exclude: ["WebSdk", "@digitalpersona/devices", "@digitalpersona/services", "@digitalpersona/core"],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'radix-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-accordion',
            '@radix-ui/react-popover',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-switch',
            '@radix-ui/react-slider',
            '@radix-ui/react-label',
            '@radix-ui/react-separator',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-avatar',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-alert-dialog',
          ],
          'charts': ['recharts'],
          'pdf': ['jspdf', 'jspdf-autotable'],
          'supabase': ['@supabase/supabase-js'],
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'utils': ['date-fns', 'clsx', 'tailwind-merge', 'class-variance-authority'],
        }
      }
    }
  },
  plugins: [

    react(),
    VitePWA({
      devOptions: {
        enabled: true
      },
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 10485760, // 10MB
      },
      includeAssets: [],
      manifest: {
        name: 'WinPOS System',
        short_name: 'WinPOS',
        description: 'Modern Point of Sale System',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '.',
        orientation: 'any',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "WebSdk": path.resolve(__dirname, "node_modules/@digitalpersona/websdk/dist/websdk.client.ui.js"),
    },
  },
  define: {
    'window.ES6Promise': 'window.Promise',
    'global': 'window',
  },
  server: {
    port: 3000,
    strictPort: true,
    // @ts-ignore
    allowedHosts: true,
  }
});

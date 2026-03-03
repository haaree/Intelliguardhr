import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';

    return {
      server: {
        port: 3006,
        host: '0.0.0.0',
        allowedHosts: [
          'asp.intelliguard.in',
          'localhost',
          '.pages.dev'
        ],
        hmr: isProduction ? false : {
          protocol: 'ws',
          host: 'localhost',
          port: 3006,
        }
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon-192.svg', 'icon-512.svg', 'manifest.json'],
          manifest: {
            name: 'IntelliGuard HR - Advanced Attendance & Workforce Analytics',
            short_name: 'IntelliGuard HR',
            description: 'Advanced Attendance & Workforce Analytics System',
            theme_color: '#0d9488',
            background_color: '#ffffff',
            display: 'standalone',
            icons: [
              {
                src: 'icon-192.svg',
                sizes: '192x192',
                type: 'image/svg+xml'
              },
              {
                src: 'icon-512.svg',
                sizes: '512x512',
                type: 'image/svg+xml'
              }
            ]
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'tailwind-cdn-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 30
                  }
                }
              }
            ]
          },
          devOptions: {
            enabled: false
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        sourcemap: false,
        minify: isProduction ? 'esbuild' : false,
        target: 'es2020',
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            manualChunks: undefined
          }
        }
      },
      preview: {
        port: 3006,
        host: '0.0.0.0',
        allowedHosts: [
          'asp.intelliguard.in',
          'localhost',
          '.pages.dev'
        ]
      }
    };
});

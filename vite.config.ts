import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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
      plugins: [react()],
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

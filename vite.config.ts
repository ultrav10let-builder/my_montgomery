import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replaceAll('\\', '/');
            if (!normalizedId.includes('node_modules')) return undefined;
            if (normalizedId.includes('react-leaflet') || normalizedId.includes('/leaflet/')) return 'map-vendor';
            if (normalizedId.includes('/lucide-react/')) return 'icons-vendor';
            if (normalizedId.includes('/date-fns/') || normalizedId.includes('/date-fns-tz/')) return 'date-vendor';
            if (
              normalizedId.includes('/react/')
              || normalizedId.includes('/react-dom/')
              || normalizedId.includes('/scheduler/')
            ) {
              return 'react-vendor';
            }
            return 'vendor';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Proxy /api to backend when running `npx vite` separately (frontend on 5173, backend on 5174)
      proxy: {
        '/api': { target: `http://localhost:${env.PORT || '8080'}`, changeOrigin: true },
      },
    },
  };
});

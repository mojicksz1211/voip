import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

const isCapacitor = process.env.CAPACITOR === 'true';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), '');
  const pbxTarget = env.VITE_PBX_PROXY_TARGET || 'http://127.0.0.1:3000';

  return {
    base: isCapacitor ? './' : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@hotel-voip/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      },
    },
    server: {
      host: true,
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': {
          target: pbxTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': {
          target: pbxTarget,
          changeOrigin: true,
        },
      },
    },
  };
});

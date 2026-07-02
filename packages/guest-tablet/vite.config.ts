import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const isCapacitor = process.env.CAPACITOR === 'true';

export default defineConfig({
  base: isCapacitor ? './' : '/guest/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@hotel-voip/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});

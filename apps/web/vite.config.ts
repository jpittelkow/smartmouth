import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development Vite serves the pages and passes the socket and API through to the Node server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://localhost:8470', ws: true },
      '/api': 'http://localhost:8470',
      '/media': 'http://localhost:8470',
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});

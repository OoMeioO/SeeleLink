import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: './',
  build: { outDir: 'dist-electron', emptyOutDir: true, sourcemap: false, minify: false, chunkSizeWarningLimit: 1000 },
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    host: '0.0.0.0', // Allow LAN access
    allowedHosts: true, // Allow all hosts for WebBridge connections
  },
  css: { devSourcemap: true },
});

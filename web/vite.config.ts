import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Geliştirmede /api istekleri backend'e (3001) proxy'lenir.
// Üretimde web ve api aynı sunucuda; VITE_API_URL ile de override edilebilir.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // LAN'daki diğer cihazlardan erişim
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3011',
        changeOrigin: true,
      },
      // WebSocket (socket.io) dev'de de backend'e taşınsın (canlı güncellemeler).
      '/socket.io': {
        target: 'http://localhost:3011',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});

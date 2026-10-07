import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  envDir: '../../',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@mui/') || id.includes('/node_modules/@emotion/')) return 'ui-vendor';
          if (id.includes('/node_modules/oidc-client-ts/') || id.includes('/node_modules/react-oidc-context/')) return 'auth-vendor';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    exclude: ['e2e/**', 'node_modules/**'],
  },
});

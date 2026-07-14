import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          [
            '@babel/plugin-transform-react-jsx',
            {
              runtime: 'automatic',
            },
          ],
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 13579,
    strictPort: false,
  },
  preview: {
    host: '0.0.0.0',
    port: 4000,
    strictPort: false,
  },
});

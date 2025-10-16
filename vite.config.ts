import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@types': path.resolve(__dirname, './types'),
      '@components': path.resolve(__dirname, './src/components'),
      '@adapters': path.resolve(__dirname, './src/adapters')
    }
  },
  build: {
    outDir: 'dist-react',
    rollupOptions: {
      input: {
        'usta-modu': path.resolve(__dirname, 'src/components/usta-modu-entry.tsx'),
        'learning-dashboard': path.resolve(__dirname, 'src/renderer/learning-dashboard-entry.tsx')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
        // ES modules format (default)
      }
    }
  }
});

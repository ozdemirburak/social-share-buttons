import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'SocialShareButtons',
      formats: ['es', 'umd', 'iife'],
      fileName: (format) => {
        if (format === 'es') return 'social-share-buttons.js';
        if (format === 'umd') return 'social-share-buttons.umd.js';
        if (format === 'iife') return 'social-share-buttons.iife.js';
        return `social-share-buttons.${format}.js`;
      },
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.names[0] === 'style.css') return 'social-share-buttons.css';
          return assetInfo.names[0] || '';
        },
      },
      onwarn(warning, warn) {
        // Suppress "named and default exports" warning for mixed export patterns
        if (warning.code === 'MIXED_EXPORTS') return;
        warn(warning);
      },
    },
    sourcemap: true,
    minify: 'esbuild',
  },
  css: {
    postcss: {},
  },
});

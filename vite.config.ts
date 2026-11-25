import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
  return {
    base: command === 'build' ? '/BUGGY-AI/' : '/',
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ and prepares GitHub Pages SPA fallback (404.html + .nojekyll).
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(rootDir, 'dist');
          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }

          // GitHub Pages SPA routing & static asset compatibility
          const indexFile = path.join(distDir, 'index.html');
          const fallback404 = path.join(distDir, '404.html');
          if (fs.existsSync(indexFile)) {
            fs.copyFileSync(indexFile, fallback404);
          }
          if (fs.existsSync(distDir)) {
            fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

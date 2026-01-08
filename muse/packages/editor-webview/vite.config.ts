import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

const editorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Mythos Editor</title>
  <link rel="stylesheet" href="style.css">
  <style>
    * { box-sizing: border-box; }
    html, body, #root { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    @media (prefers-color-scheme: dark) { body { background: #1a1a1a; color: #e5e5e5; } }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="editor.bundle.js"></script>
</body>
</html>`;

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'generate-html',
      closeBundle() {
        mkdirSync(resolve(__dirname, 'build'), { recursive: true });
        writeFileSync(resolve(__dirname, 'build/editor.html'), editorHtml);
      },
    },
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/bundle-entry.tsx'),
      name: 'EditorBundle',
      formats: ['iife'],
      fileName: () => 'editor.bundle.js',
    },
    outDir: 'build',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: '[name][extname]',
      },
    },
    cssCodeSplit: false,
    minify: 'terser',
  },
});

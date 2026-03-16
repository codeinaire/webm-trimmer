import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // wavesurfer.js 7.12.3 ships regions.js (ESM) but the package.json exports map
      // points to regions.esm.js and regions.cjs which do not exist in this release.
      // Alias both potential paths to the actual file to allow Rollup to bundle it.
      'wavesurfer.js/dist/plugins/regions.esm.js': path.resolve(
        'node_modules/wavesurfer.js/dist/plugins/regions.js',
      ),
      'wavesurfer.js/dist/plugins/regions.js': path.resolve(
        'node_modules/wavesurfer.js/dist/plugins/regions.js',
      ),
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'esnext',
  },
})

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// Imtihon skaneri PDF ni pdf.js bilan ochadi. Oq-qora skaner PDF lari ko'pincha
// JBIG2 yoki JPEG2000 bilan siqilgan — ularning dekoderlari (wasm va wasm'siz
// zaxirasi) `wasmUrl` papkasidan qat'iy nom bilan yuklanadi, shuning uchun
// hashsiz nusxa /pdfjs-wasm/ ga qo'yiladi (src/lib/omr/skaner.ts).
const PDFJS_WASM = ['jbig2.wasm', 'jbig2_nowasm_fallback.js', 'openjpeg.wasm', 'openjpeg_nowasm_fallback.js', 'qcms_bg.wasm'];
function pdfjsWasm(): Plugin {
  const dir = path.resolve(__dirname, 'node_modules/pdfjs-dist/wasm');
  return {
    name: 'pdfjs-wasm',
    generateBundle() {
      for (const f of PDFJS_WASM) this.emitFile({ type: 'asset', fileName: `pdfjs-wasm/${f}`, source: fs.readFileSync(path.join(dir, f)) });
    },
    configureServer(server) {
      server.middlewares.use('/pdfjs-wasm', (req, res, next) => {
        const f = (req.url || '').split('?')[0].replace(/^\//, '');
        if (!PDFJS_WASM.includes(f)) return next();
        res.setHeader('Content-Type', f.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        fs.createReadStream(path.join(dir, f)).pipe(res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), pdfjsWasm()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
            'vendor-motion': ['motion/react'],
            'vendor-canvas': ['html2canvas'],
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
    },
  };
});

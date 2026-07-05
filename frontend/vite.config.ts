import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isAnalyze = process.env.ANALYZE === 'true';

function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('recharts')) return 'vendor-charts';
  if (id.includes('xlsx')) return 'vendor-xlsx';
  if (id.includes('html2canvas')) return 'vendor-html2canvas';
  if (id.includes('jspdf')) return 'vendor-jspdf';
  if (id.includes('jszip')) return 'vendor-jszip';
  if (id.includes('@supabase')) return 'vendor-supabase';
  if (id.includes('@tanstack')) return 'vendor-query';
  if (id.includes('react')) return 'vendor-react';
  return undefined;
}

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api/functions": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/ai": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai/, ""),
        headers: {
          "X-Internal-Key": process.env.AI_INTERNAL_KEY ?? "",
        },
      },
    },
  },
  plugins: [
    react(),
    ...(isAnalyze
      ? [
          visualizer({
            open: true,
            gzipSize: true,
            brotliSize: true,
            filename: 'dist/stats.html',
          }),
        ]
      : []),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@app": path.resolve(__dirname, "./app"),
      "@services": path.resolve(__dirname, "./services"),
      "@modules": path.resolve(__dirname, "./modules"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
});

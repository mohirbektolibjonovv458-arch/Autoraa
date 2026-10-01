import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Production build'dan keyin service worker yaratadi:
 * - VERSION — build fayllari hash'i (har yangi deploy'da eski kesh avtomatik tozalanadi)
 * - PRECACHE — ilova qobig'i: JS/CSS, offline sahifa, asosiy ikonkalar
 */
function avtoraServiceWorker(): Plugin {
  return {
    name: "avtora-service-worker",
    apply: "build",
    writeBundle(options, bundle) {
      const outDir = options.dir!;
      const assets = Object.keys(bundle).filter((f) => /^assets\/.+\.(js|css|woff2?)$/.test(f)).sort();
      const version = createHash("sha256").update(assets.join("|")).digest("hex").slice(0, 12);
      const precache = ["/index.html", "/offline.html", "/offline.js", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/favicon.ico", "/brand/avtora-logo.png", "/brand/mark-light.png", "/brand/mark-dark.png", ...assets.map((a) => "/" + a)];
      const tpl = readFileSync(resolve(__dirname, "pwa/sw.template.js"), "utf8");
      writeFileSync(resolve(outDir, "sw.js"), tpl.replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(precache, null, 2)));
    },
  };
}

// npm run build -> tayyor sayt backend/frontend_build ga tushadi va Django uni o'zi beradi
export default defineConfig({
  plugins: [react(), avtoraServiceWorker()],
  build: { outDir: "../backend/frontend_build", emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/media": "http://127.0.0.1:8000",
    },
  },
});

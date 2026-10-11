import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// npm run build -> backend/frontend_build (Django uni o'zi beradi)
export default defineConfig({
  plugins: [react()],
  build: { outDir: "../backend/frontend_build", emptyOutDir: true, chunkSizeWarningLimit: 1200 },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8000" } },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 開発時は /api をバックエンド（デフォルト 3001）にプロキシする
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});

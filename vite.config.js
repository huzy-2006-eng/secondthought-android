import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the backend runs on :8000; in production it serves this app itself.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      "/api": "http://localhost:8000",
      "/ws": { target: "ws://localhost:8000", ws: true },
    },
  },
});

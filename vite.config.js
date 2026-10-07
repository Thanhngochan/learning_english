import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Front end on :5173, our own API (server/index.js) on :8787.
const proxy = { "/api": "http://localhost:8787" };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
});

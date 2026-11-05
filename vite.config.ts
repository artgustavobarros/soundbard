import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: process.env.SOUNDBARD_E2E_ENV_DIR,
  plugins: [tailwindcss(), tanstackStart({ spa: { enabled: true } }), react()],
  resolve: { tsconfigPaths: true },
  server: {
    proxy: { "/api": process.env.SOUNDBARD_API_URL ?? "http://127.0.0.1:8000" },
  },
});

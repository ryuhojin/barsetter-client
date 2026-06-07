import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ["Android >= 5"]
    })
  ]
});

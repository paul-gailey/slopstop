import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, "src/popup"),
  base: "./",
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: false,
    target: "esnext",
    minify: "esbuild",
    rollupOptions: {
      input: resolve(__dirname, "src/popup/index.html"),
      output: {
        entryFileNames: "popup.js",
        chunkFileNames: "popup-[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) return "popup.css";
          return "popup-[name][extname]";
        },
      },
    },
  },
});

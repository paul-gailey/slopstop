import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: false,
    target: "esnext",
    minify: "esbuild",
    rollupOptions: {
      input: resolve(__dirname, "src/background/index.ts"),
      output: {
        entryFileNames: "background.js",
        inlineDynamicImports: true,
      },
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";

const app = process.env.ZS_APP;
if (!app) throw new Error("ZS_APP env var required (e.g. ZS_APP=trace-progress)");

export default defineConfig({
  root: resolve(__dirname, app),
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: resolve(__dirname, "../dist-apps", app),
    emptyOutDir: true,
  },
});

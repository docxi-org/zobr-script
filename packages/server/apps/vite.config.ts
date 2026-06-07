import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const appsDir = resolve(__dirname);
const entries: Record<string, string> = {};

for (const dir of readdirSync(appsDir, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const html = join(appsDir, dir.name, "index.html");
  if (existsSync(html)) entries[dir.name] = html;
}

export default defineConfig({
  root: appsDir,
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: resolve(__dirname, "../dist-apps"),
    rollupOptions: {
      input: entries,
    },
    emptyOutDir: true,
  },
});

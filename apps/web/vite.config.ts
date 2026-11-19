import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// The round page's script and styles, served by the API from its own host (ADR 0070, D5): no CDN, no Google Fonts.
// Hashed names and a manifest, read by the Razor page; the folder is build output (.gitignore).
const OUTPUT = fileURLToPath(new URL("../api/src/Sacou.Api/wwwroot/web", import.meta.url));
const ENTRY = fileURLToPath(new URL("src/main.ts", import.meta.url));

export default defineConfig({
  base: "/web/",
  publicDir: false,
  build: {
    outDir: OUTPUT,
    emptyOutDir: true,
    manifest: "manifest.json",
    // Fonts stay files: the CSP has no data: in font-src.
    assetsInlineLimit: 0,
    modulePreload: false,
    sourcemap: false,
    rollupOptions: { input: { round: ENTRY } },
  },
  test: { environment: "node" },
});

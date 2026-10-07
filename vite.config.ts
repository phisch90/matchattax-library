import { execSync } from "node:child_process";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Welcher Stand steckt in diesem Build? In der GitHub-Action steht der Commit in
 * GITHUB_SHA; lokal fragen wir git. Schlägt beides fehl, sagt die App „unbekannt"
 * statt eine Zahl zu erfinden.
 */
function buildVersion(): { commit: string; builtAt: string } {
  const fromEnv = process.env.GITHUB_SHA;
  let commit = fromEnv === undefined ? "" : fromEnv.slice(0, 7);
  if (commit === "") {
    try {
      commit = execSync("git rev-parse --short=7 HEAD", { encoding: "utf8" }).trim();
    } catch {
      commit = "unbekannt";
    }
  }
  return { commit, builtAt: new Date().toISOString() };
}

const VERSION = buildVersion();

/**
 * Schreibt `version.json` neben die App, damit die LAUFENDE App nachsehen kann,
 * welcher Stand veröffentlicht ist, und selbst sagt, ob sie veraltet ist.
 *
 * Die Datei darf NICHT in den Service-Worker-Cache: sonst vergleicht die App ihre
 * eigene, mitgelieferte Kopie mit sich selbst und meldet immer „aktuell".
 */
function versionFile(): Plugin {
  return {
    name: "kartenmappe-version-file",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: `${JSON.stringify(VERSION, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig({
  define: {
    __APP_COMMIT__: JSON.stringify(VERSION.commit),
    __APP_BUILT_AT__: JSON.stringify(VERSION.builtAt),
  },
  // Für GitHub Pages (https://<user>.github.io/<repo>/) setzt das Deployment
  // PAGES_BASE=/<repo>/; lokal bleibt es "/".
  base: process.env.PAGES_BASE ?? "/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": ein Update unterbricht nie das Eintragen einer Kartenserie.
      registerType: "prompt",
      manifest: {
        name: "Kartenmappe — Match Attax Sammlung",
        short_name: "Kartenmappe",
        description: "Sammlung und Teambau für Topps Match Attax, lokal auf dem Gerät",
        lang: "de",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "icon-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json,woff2}"],
        // …außer der Versionsdatei: die muss vom Server kommen.
        globIgnores: ["**/version.json"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
    versionFile(),
  ],
});

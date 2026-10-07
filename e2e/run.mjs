#!/usr/bin/env node
/*
  Der Laeufer: baut die App, stellt sie auf 5198 hin, laesst die Strecken laufen
  und raeumt hinterher auf.

    pnpm e2e                 alle Strecken
    pnpm e2e grundlauf       nur diese
    pnpm e2e --no-build      gegen den Stand in dist

  WARUM gegen den GEBAUTEN Bogen: die Fehler, die hier gefunden werden, entstehen
  erst im Build — ein Hook hinter einem frueheren return, ein Service Worker, der
  jede Navigation aus dem Zwischenspeicher beantwortet. `pnpm test` und `tsc`
  sehen davon nichts.

  KOPFNOTIZ: keine deutschen Anfuehrungszeichen in dieser Datei.
*/
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const E2E = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(E2E);
const DIST = join(ROOT, "dist");
const PORT = 5198;
const BASE = `http://localhost:${PORT}`;

const args = process.argv.slice(2);
const bauen = !args.includes("--no-build");
const gewuenscht = args.filter((a) => !a.startsWith("--"));

const strecken = readdirSync(join(E2E, "strecken"))
  .filter((f) => f.endsWith(".mjs"))
  .filter((f) => gewuenscht.length === 0 || gewuenscht.some((g) => f.includes(g)))
  .sort();

if (strecken.length === 0) {
  console.error(`keine Strecke passt zu: ${gewuenscht.join(" ")}`);
  process.exit(1);
}

if (bauen) {
  console.log("== Bauen");
  const bau = spawnSync("pnpm", ["build"], { cwd: ROOT, stdio: "inherit" });
  if (bau.status !== 0) process.exit(bau.status ?? 1);
} else if (!existsSync(DIST)) {
  console.error("dist fehlt — ohne --no-build starten");
  process.exit(1);
}

/** Der Namensstempel des frischen Builds, damit die Vorschau nicht auf Altem sitzt. */
function bundleAusDist() {
  const html = readFileSync(join(DIST, "index.html"), "utf8");
  const m = /assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(html);
  if (m === null) throw new Error("kein index-*.js in dist/index.html");
  return m[1];
}

console.log(`\n== Vorschau auf ${BASE}`);
const preview = spawn("pnpm", ["exec", "vite", "preview", "--port", String(PORT), "--strictPort"], {
  cwd: ROOT,
  stdio: ["ignore", "pipe", "pipe"],
});
let previewLog = "";
preview.stdout.on("data", (d) => (previewLog += d));
preview.stderr.on("data", (d) => (previewLog += d));

const schluss = () => {
  if (!preview.killed) preview.kill("SIGTERM");
};
process.on("exit", schluss);
process.on("SIGINT", () => {
  schluss();
  process.exit(130);
});

let bereit = false;
for (let i = 0; i < 60; i++) {
  try {
    const antwort = await fetch(BASE, { signal: AbortSignal.timeout(1500) });
    if (antwort.ok) {
      const html = await antwort.text();
      const erwartet = bundleAusDist();
      if (!html.includes(erwartet)) {
        console.error(`\nDie Vorschau zeigt einen ANDEREN Stand: erwartet ${erwartet}`);
        process.exit(1);
      }
      bereit = true;
      break;
    }
  } catch {
    /* noch nicht da */
  }
  await new Promise((r) => setTimeout(r, 500));
}
if (!bereit) {
  console.error(`Vorschau kam nicht hoch:\n${previewLog}`);
  process.exit(1);
}
console.log(`   Stand ${bundleAusDist()} ausgeliefert`);

const ergebnisse = [];
for (const datei of strecken) {
  console.log(`\n===== ${datei}`);
  const lauf = spawnSync(process.execPath, [join(E2E, "strecken", datei)], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, KARTEN_BASE: BASE },
  });
  ergebnisse.push({ datei, code: lauf.status ?? 1 });
}

console.log("\n===== Zusammen");
for (const { datei, code } of ergebnisse) {
  console.log(`  ${code === 0 ? "gruen" : "ROT  "}  ${datei}`);
}
const rot = ergebnisse.filter((e) => e.code !== 0);
console.log(`\n${ergebnisse.length - rot.length} von ${ergebnisse.length} Strecken gruen`);
process.exit(rot.length === 0 ? 0 : 1);

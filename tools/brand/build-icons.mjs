#!/usr/bin/env node
/*
  Erzeugt die App-Symbole aus EINER Zeichnung (unten als SVG), gerendert mit dem
  Chromium, das fuer die Teststrecken ohnehin da ist. Keine Bildbibliothek noetig.

    pnpm icons

  Zwei Saetze: das normale Symbol fuellt die Flaeche randvoll; die maskable-Fassung
  bringt eigene Luft mit, weil Android eine Maske (Kreis, Squircle) darueberlegt
  und sonst den Rand abschneidet.

  KOPFNOTIZ: keine deutschen Anfuehrungszeichen in dieser Datei.
*/
import { chromium } from "playwright";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const PUBLIC = join(ROOT, "public");
mkdirSync(PUBLIC, { recursive: true });

/* Eine Sammelkarte, leicht gedreht, auf Rasengruen — und ein Stern als Marke. */
function svg(size, padded) {
  const inset = padded ? 0.18 : 0.08;
  const s = size;
  const p = s * inset;
  const w = s - 2 * p;
  const cardW = w * 0.56;
  const cardH = cardW * 88 / 63;
  const cx = s / 2;
  const cy = s / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#166534"/>
      <stop offset="1" stop-color="#052e16"/>
    </linearGradient>
    <linearGradient id="c" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8fafc"/>
      <stop offset="1" stop-color="#cbd5e1"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" rx="${padded ? 0 : s * 0.2}" fill="url(#g)"/>
  <g transform="translate(${cx} ${cy}) rotate(-8)">
    <rect x="${-cardW / 2 + cardW * 0.08}" y="${-cardH / 2 + cardH * 0.06}" width="${cardW}" height="${cardH}" rx="${cardW * 0.08}" fill="#0f172a" opacity="0.35"/>
    <rect x="${-cardW / 2}" y="${-cardH / 2}" width="${cardW}" height="${cardH}" rx="${cardW * 0.08}" fill="url(#c)"/>
    <rect x="${-cardW / 2 + cardW * 0.1}" y="${-cardH / 2 + cardH * 0.08}" width="${cardW * 0.8}" height="${cardH * 0.5}" rx="${cardW * 0.05}" fill="#f59e0b"/>
    <rect x="${-cardW / 2 + cardW * 0.1}" y="${cardH * 0.12}" width="${cardW * 0.8}" height="${cardH * 0.1}" rx="${cardW * 0.03}" fill="#334155"/>
    <rect x="${-cardW / 2 + cardW * 0.1}" y="${cardH * 0.27}" width="${cardW * 0.5}" height="${cardH * 0.08}" rx="${cardW * 0.03}" fill="#94a3b8"/>
    <polygon transform="translate(0 ${-cardH * 0.17}) scale(${cardW * 0.011})"
      points="0,-16 4.7,-5 16,-5 7,2 10,13 0,6 -10,13 -7,2 -16,-5 -4.7,-5" fill="#0f172a"/>
  </g>
</svg>`;
}

const browser = await chromium.launch({
  executablePath: chromeExecutable(),
  args: ["--no-sandbox"],
});
const page = await browser.newPage();

async function render(name, size, padded) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size, padded)}</body></html>`);
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(join(PUBLIC, name), png);
  console.log(`  ${name} (${size}px)`);
}

await render("icon-512.png", 512, false);
await render("icon-192.png", 192, false);
await render("icon-maskable-512.png", 512, true);
await render("icon-maskable-192.png", 192, true);
await render("apple-touch-icon.png", 180, false);
await render("favicon-32.png", 32, false);
await browser.close();

function chromeExecutable() {
  const fromEnv = process.env.CHROMIUM_PATH;
  if (fromEnv !== undefined && existsSync(fromEnv)) return fromEnv;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (existsSync(root)) {
    for (const entry of readdirSync(root)) {
      if (!entry.startsWith("chromium-")) continue;
      const exe = join(root, entry, "chrome-linux", "chrome");
      if (existsSync(exe)) return exe;
    }
  }
  return undefined;
}

/*
  Die gemeinsame Huelle aller Teststrecken — uebernommen aus Chardex35, wo die
  Fallen darin alle schon einmal bezahlt wurden:

  1. CSS `uppercase` veraendert `innerText`: JEDE Textpruefung mit /i.
  2. Gelesen wird im Kasten, nicht im Body — ein Blatt steht WEIT hinten im DOM.
  3. Eine Navigationshilfe darf nicht still scheitern: sie WIRFT.
  4. Ein frisches Browserprofil je Lauf, sonst zaehlt der Rest vom letzten Mal mit.
  5. Kein fest verdrahteter Browserpfad.

  KOPFNOTIZ: keine deutschen Anfuehrungszeichen in diesem Ordner. Backticks.
*/
import { chromium } from "playwright";
import { existsSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const BASE = process.env.KARTEN_BASE ?? "http://localhost:5198";
export const E2E_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

/** Die drei Groessen: sein iPhone und sein iPad, beide Lagen. */
export const GROESSEN = [
  ["iphone", 390, 844],
  ["ipad-quer", 1180, 820],
  ["ipad-hoch", 820, 1180],
];

export function chromeExecutable() {
  const fromEnv = process.env.CHROMIUM_PATH;
  if (fromEnv !== undefined && existsSync(fromEnv)) return fromEnv;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (existsSync(root)) {
    for (const name of readdirSync(root)) {
      if (!name.startsWith("chromium-")) continue;
      const exe = join(root, name, "chrome-linux", "chrome");
      if (existsSync(exe)) return exe;
    }
  }
  return undefined;
}

/**
 * Der Zaehler. `done(n)` nennt eine MINDESTZAHL an Pruefungen: eine Strecke, die
 * frueh abbricht, meldet sonst nicht rot, sondern gar nichts.
 */
export function createReport(titel) {
  let pass = 0;
  let fail = 0;
  const problems = [];
  const check = (label, ok, detail = "") => {
    if (ok) {
      pass++;
      console.log(`    ok   ${label}`);
    } else {
      fail++;
      problems.push(`${label}${detail ? ` — ${detail}` : ""}`);
      console.log(`    FAIL ${label}${detail ? ` — ${detail}` : ""}`);
    }
  };
  const done = (mindestens = 0) => {
    console.log(`\n${titel}: ${pass} ok, ${fail} FAIL`);
    for (const p of problems) console.log(`  - ${p}`);
    if (pass + fail < mindestens) {
      console.log(`  - ZU WENIG GEPRUEFT: ${pass + fail} statt ${mindestens} — die Strecke ist unterwegs abgebrochen`);
      process.exit(1);
    }
    process.exit(fail === 0 ? 0 : 1);
  };
  return {
    check,
    done,
    get pass() {
      return pass;
    },
    get fail() {
      return fail;
    },
  };
}

/** Ein frischer Browser mit frischem Profil. */
export async function oeffneApp(width, height) {
  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "karten-")), {
    executablePath: chromeExecutable(),
    viewport: { width, height },
    args: ["--no-sandbox"],
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const seitenfehler = [];
  const dialoge = [];
  page.on("pageerror", (e) => seitenfehler.push(String(e)));
  page.on("dialog", (d) => {
    dialoge.push(d.message());
    void d.dismiss();
  });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  return { ctx, page, seitenfehler, dialoge };
}

export const bodyText = (page) => page.locator("body").innerText();

/** Der Text des offenen Blatts. WIRFT, wenn keines offen ist. */
export async function blattText(page) {
  const blatt = page.locator('[role="dialog"]');
  if ((await blatt.count()) === 0) throw new Error("kein offenes Blatt");
  return blatt.first().innerText();
}

/** Zur Hauptnavigation: Sammlung, Teams, Einstellungen. WIRFT, wenn der Reiter fehlt. */
export async function gehe(page, muster) {
  const link = page.locator("header nav a").filter({ hasText: muster });
  if ((await link.count()) === 0) throw new Error(`Reiter ${muster} nicht in der Hauptnavigation`);
  await link.first().click();
  await page.waitForTimeout(700);
}

/** Kein seitlicher Ueberlauf — der Body darf nie waagerecht scrollen. */
export const ueberlauf = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Ein Bild nach e2e/.out — gitignored. */
export async function bild(page, name) {
  const ziel = join(E2E_DIR, ".out");
  mkdirSync(ziel, { recursive: true });
  await page.screenshot({ path: join(ziel, `${name}.png`) });
}

/** Ein kleines Kartenbild, in der Seite gezeichnet — fuer das Foto-Feld. */
export async function probeFoto(page, farbe = "#f59e0b") {
  const dataUrl = await page.evaluate((f) => {
    const c = document.createElement("canvas");
    c.width = 630;
    c.height = 880;
    const x = c.getContext("2d");
    x.fillStyle = f;
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = "#0f172a";
    x.fillRect(60, 80, 510, 420);
    x.fillStyle = "#f8fafc";
    x.font = "bold 90px sans-serif";
    x.fillText("ATT 85", 80, 700);
    return c.toDataURL("image/png");
  }, farbe);
  return { name: "karte.png", mimeType: "image/png", buffer: Buffer.from(dataUrl.split(",")[1], "base64") };
}

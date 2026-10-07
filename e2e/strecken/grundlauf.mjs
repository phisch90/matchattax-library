/*
  Grundlauf: Karte per Foto anlegen (Serienmodus), Sammlung filtern, durchschreibend
  bearbeiten, Zurueck mit gemerkter Scroll-Hoehe, Team in 4-3-3 fuellen, Budget und
  Positions-Warnungen, Aufstellung wechseln, Karte loeschen (Reihenfolge der Knoepfe),
  Sicherung speichern und wieder einlesen. Danach kurz in den zwei iPad-Groessen.

  KOPFNOTIZ: keine deutschen Anfuehrungszeichen in dieser Datei. Jede Textpruefung mit /i.
*/
import { readFileSync } from "node:fs";
import {
  bild,
  blattText,
  bodyText,
  createReport,
  gehe,
  oeffneApp,
  probeFoto,
  ueberlauf,
} from "../lib/probe.mjs";

const { check, done } = createReport("grundlauf");
const POS = { gk: 0, def: 1, mid: 2, att: 3 };

/**
 * Eine Karte durch den Assistenten tragen: Foto (oder ohne) -> Name -> Verein ->
 * Position -> Werte -> Speichern. Enter auf der Tastatur ist `Weiter`. WIRFT, wenn
 * der Assistent nicht am Foto-Schritt steht — sonst klickt die Strecke ins Leere und
 * klagt danach die App an.
 */
async function legeKarte(page, { name, pos, att, def, wert, foto, club }) {
  if (!/#\/karte\/neu/.test(page.url())) throw new Error(`nicht im Assistenten, sondern ${page.url()}`);
  if ((await schritt(page)) !== "foto") throw new Error(`Assistent steht auf ${await schritt(page)}, nicht auf foto`);
  if (foto) {
    await page.locator('input[type=file][accept="image/*"]').setInputFiles(foto);
    await page.waitForTimeout(700);
  } else {
    await page.getByRole("button", { name: /Ohne Foto weiter/i }).click();
  }
  await page.fill("#karte-name", name);
  await page.press("#karte-name", "Enter");
  if (club !== undefined) {
    const chip = page.locator('[role="group"][aria-label="Verein"] button').filter({ hasText: club });
    if ((await chip.count()) > 0) await chip.first().click();
    else {
      await page.fill("#karte-club", club);
      await page.press("#karte-club", "Enter");
    }
  } else {
    await page.press("#karte-club", "Enter");
  }
  await page.locator('[role="group"][aria-label="Position"] button').nth(POS[pos]).click();
  await page.fill("#karte-att", String(att));
  await page.press("#karte-att", "Enter");
  await page.fill("#karte-def", String(def));
  await page.press("#karte-def", "Enter");
  await page.fill("#karte-wert", wert);
  await page.press("#karte-wert", "Enter");
  await page.waitForTimeout(500);
}

/** Auf welchem Schritt der Assistent steht — aus dem DOM, nicht aus dem Text. */
const schritt = (page) => page.locator('[data-testid="wizard"]').getAttribute("data-step");

async function kacheln(page) {
  return page.locator('[data-testid="card-grid"] [data-card-id]').count();
}

async function oeffneKachel(page, muster) {
  const kachel = page.locator('[data-testid="card-grid"] [data-card-id]').filter({ hasText: muster });
  if ((await kachel.count()) === 0) throw new Error(`keine Kachel ${muster}`);
  await kachel.first().click();
  await page.waitForTimeout(600);
  if (!/#\/karte\/[0-9a-f-]{8,}/i.test(page.url())) throw new Error(`nicht in der Karte, sondern ${page.url()}`);
}

/** Einen Platz im Team besetzen: erstes Angebot, das NICHT schon im Team steht. */
async function besetze(page, slot, { alle = false, suche = "" } = {}) {
  await page.locator(`[data-slot="${slot}"]`).click();
  await page.locator('[role="dialog"]').first().waitFor({ timeout: 5000 });
  if (alle) await page.locator('[role="dialog"] button').filter({ hasText: /Alle Positionen/i }).click();
  if (suche !== "") await page.fill('[role="dialog"] input[type=search]', suche);
  await page.waitForTimeout(250);
  const angebote = page.locator('[role="dialog"] [data-testid="picker-list"] button');
  const frei = angebote.filter({ hasNotText: /auf Platz|im Tor/i });
  const ziel = suche !== "" ? angebote.first() : frei.first();
  if ((await ziel.count()) === 0) throw new Error(`kein Angebot fuer Platz ${slot}`);
  await ziel.click();
  await page.waitForTimeout(400);
  if ((await page.locator('[role="dialog"]').count()) !== 0) throw new Error(`Blatt fuer Platz ${slot} blieb offen`);
}

const lies = (page, id) => page.locator(`[data-testid="${id}"]`).innerText();

// ============================================================ iPhone, der ganze Weg
{
  const { ctx, page, seitenfehler, dialoge } = await oeffneApp(390, 844);

  // ---- Startseite
  check("Hauptnavigation hat drei Reiter", (await page.locator("header nav a").count()) === 3);
  check("leere Sammlung sagt es", /Noch keine Karten/i.test(await bodyText(page)));
  const umschalter = page.locator('[role="group"][aria-label*="Sammlung"] button');
  check("zwei Sammlungen in der Umschalt-Leiste", (await umschalter.count()) === 2, String(await umschalter.count()));
  check("Philipp und Sohn", /Philipp/.test(await umschalter.nth(0).innerText()) && /Sohn/.test(await umschalter.nth(1).innerText()));
  check("kein seitlicher Ueberlauf (Start)", (await ueberlauf(page)) <= 1);

  // ---- Karte anlegen: der Assistent, Wert fuer Wert
  await page.locator("a").filter({ hasText: /\+ Karte/ }).click();
  await page.waitForTimeout(600);
  check("Assistent fuer neue Karte offen", /#\/karte\/neu/.test(page.url()), page.url());
  check("erster Schritt ist das Foto", (await schritt(page)) === "foto", String(await schritt(page)));
  check("Saison ist vorbelegt", /\d\d\/\d\d/.test(await lies(page, "kept-line")), await lies(page, "kept-line"));

  // Saison einmal auf 25/26 stellen — sie bleibt dann fuer alle weiteren Karten stehen
  await page.getByRole("button", { name: /^ändern$/ }).click();
  await page.locator('[role="group"][aria-label="Saison"] button').filter({ hasText: /^25\/26$/ }).click();
  check("Saison steht in der Bleibt-Zeile", /25\/26/.test(await lies(page, "kept-line")), await lies(page, "kept-line"));
  await page.getByRole("button", { name: /^ändern$/ }).click();

  // Ohne Namen gibt es kein Weiter
  await page.getByRole("button", { name: /Ohne Foto weiter/i }).click();
  check("ohne Foto: beim Namen", (await schritt(page)) === "name");
  await page.press("#karte-name", "Enter");
  check("ohne Namen: Hinweis statt Weiter", /Ohne Namen geht es nicht/i.test(await bodyText(page)) && (await schritt(page)) === "name");
  await page.getByRole("button", { name: /^Zurück$/ }).click();
  check("Zurueck fuehrt zum Foto", (await schritt(page)) === "foto");

  const foto = await probeFoto(page);
  await legeKarte(page, { name: "Torwart Eins", club: "FC Probe", pos: "gk", att: 10, def: 80, wert: "9.5", foto });
  check("Bestaetigung nach dem Speichern", /Gespeichert: Torwart Eins/i.test(await bodyText(page)));
  check("danach wieder beim Foto der naechsten Karte", (await schritt(page)) === "foto");
  check("Zaehler: 1 Karte gespeichert", /1 Karte gespeichert/i.test(await bodyText(page)));
  check("Foto der vorigen Karte ist weg", (await page.locator('[data-testid="wizard-thumb"]').count()) === 0);
  check("Saison bleibt stehen", /25\/26/.test(await lies(page, "kept-line")));

  // Der zuletzt benutzte Verein steht als Knopf, die Position hat kein Weiter ohne Wahl
  await bild(page, "iphone-schritt-foto");
  await page.getByRole("button", { name: /Ohne Foto weiter/i }).click();
  await page.fill("#karte-name", "Verteidiger Eins");
  await bild(page, "iphone-schritt-name");
  await page.press("#karte-name", "Enter");
  check("Verein-Schritt", (await schritt(page)) === "verein");
  await bild(page, "iphone-schritt-verein");
  const vereinChip = page.locator('[role="group"][aria-label="Verein"] button').filter({ hasText: /^FC Probe$/ });
  check("zuletzt benutzter Verein steht als Knopf", (await vereinChip.count()) === 1);
  await vereinChip.click();
  check("Vereins-Knopf springt zur Position", (await schritt(page)) === "position");
  await bild(page, "iphone-schritt-position");
  check("Position: vier Knoepfe, kein Weiter", (await page.locator('[role="group"][aria-label="Position"] button').count()) === 4 && (await page.getByRole("button", { name: /^Weiter$/ }).count()) === 0);
  await page.locator('[role="group"][aria-label="Position"] button').nth(POS.def).click();
  check("Position springt zu den Werten", (await schritt(page)) === "werte");
  await page.fill("#karte-att", "30");
  await page.press("#karte-att", "Enter");
  await page.fill("#karte-def", "70");
  await page.press("#karte-def", "Enter");
  await page.fill("#karte-wert", "9,5");
  await bild(page, "iphone-schritt-werte");
  await page.press("#karte-wert", "Enter");
  await page.waitForTimeout(500);
  check("Enter im Wert speichert", /Gespeichert: Verteidiger Eins/i.test(await bodyText(page)) && (await schritt(page)) === "foto");

  // Der Rest der Mannschaft: 3 weitere VER, 4 MIT, 3 ANG — alle 9.5M, damit 11 Karten 104.5M ergeben
  for (const n of ["Zwei", "Drei", "Vier"]) await legeKarte(page, { name: `Verteidiger ${n}`, club: "FC Probe", pos: "def", att: 30, def: 70, wert: "9,5" });
  for (const n of ["Eins", "Zwei", "Drei", "Vier"]) await legeKarte(page, { name: `Mittelfeld ${n}`, club: "FC Probe", pos: "mid", att: 60, def: 60, wert: "9.5" });
  for (const n of ["Eins", "Zwei", "Drei"]) await legeKarte(page, { name: `Stuermer ${n}`, club: "FC Probe", pos: "att", att: 85, def: 30, wert: "9.5M" });
  check("Zaehler zaehlt mit: 12 Karten", /12 Karten gespeichert/i.test(await bodyText(page)));

  // Doppelt-Hinweis: dieselbe Karte noch einmal
  await page.getByRole("button", { name: /Ohne Foto weiter/i }).click();
  await page.fill("#karte-name", "Torwart Eins");
  await page.waitForTimeout(400);
  check("Doppelt-Hinweis erscheint", /schon \(1×\)/i.test(await bodyText(page)));
  await page.getByRole("button", { name: /Anzahl erh/i }).click();
  await page.waitForTimeout(500);
  check("Anzahl erhoeht statt neu angelegt", /jetzt 2×/i.test(await bodyText(page)) && (await schritt(page)) === "foto");
  check("kein Browser-Dialog im Assistenten", dialoge.length === 0, dialoge.join(" | "));
  await bild(page, "iphone-assistent");

  // ---- Sammlung
  await gehe(page, /Sammlung/);
  check("12 Kacheln", (await kacheln(page)) === 12, String(await kacheln(page)));
  const summe = await lies(page, "summary");
  check("Summenzeile: 12 Karten, 13 Stueck", /12 Karten · 13 Stück/i.test(summe), summe);
  check("Summenzeile je Position", /1 TOR · 4 VER · 4 MIT · 3 ANG/i.test(summe), summe);
  check("Mehrfach-Marke x2 an der Kachel", (await page.locator('[data-card-id]').filter({ hasText: /×2/ }).count()) === 1);
  check("Kachel mit Foto zeigt ein Bild", (await page.locator('[data-card-id]').filter({ hasText: /Torwart Eins/ }).locator("img").count()) === 1);
  check("Werte stehen auf der Kachel", /85 ATT/i.test(await page.locator('[data-card-id]').filter({ hasText: /Stuermer Eins/ }).innerText()));
  check("kein seitlicher Ueberlauf (Sammlung)", (await ueberlauf(page)) <= 1);

  await page.fill('input[type=search]', "torwart");
  await page.waitForTimeout(300);
  check("Suche findet den Torwart", (await kacheln(page)) === 1);
  await page.fill('input[type=search]', "");
  await page.locator('[role="group"][aria-label="Position"] button').filter({ hasText: /^VER$/ }).click();
  await page.waitForTimeout(300);
  check("Positions-Filter VER: 4 Kacheln", (await kacheln(page)) === 4);
  await page.locator('[role="group"][aria-label="Position"] button').filter({ hasText: /^Alle$/ }).click();
  await page.selectOption("select", "att");
  await page.waitForTimeout(300);
  check("Sortierung ATT: Stuermer zuerst", /Stuermer/i.test(await page.locator('[data-card-id]').first().innerText()));
  await page.selectOption("select", "neu");
  await bild(page, "iphone-sammlung");

  // ---- Bearbeiten schreibt durch
  await oeffneKachel(page, /Mittelfeld Eins/);
  check("Bearbeiten: Titel Karte, Knopf Fertig", /Fertig/.test(await page.locator("h1 ~ button, button").filter({ hasText: /^Fertig$/ }).innerText()));
  check("Bearbeiten: keine Speichern-Leiste", (await page.getByRole("button", { name: /^Speichern/ }).count()) === 0);
  await page.fill("#karte-att", "61");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /^Fertig$/ }).click();
  await page.waitForTimeout(700);
  check("zurueck in der Sammlung", /#\/$/.test(page.url()) || page.url().endsWith("/"), page.url());
  check("geaenderter Wert steht auf der Kachel", /61 ATT/i.test(await page.locator('[data-card-id]').filter({ hasText: /Mittelfeld Eins/ }).innerText()));

  // ---- Zurueck mit gemerkter Hoehe
  const hoehe = await page.evaluate(() => document.documentElement.scrollHeight);
  check("Sammlung scrollt bei 12 Karten", hoehe > 844, String(hoehe));
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(300);
  const vorher = await page.evaluate(() => window.scrollY);
  // Eine Kachel, die GANZ im Bild ist: `locator.click()` scrollt sonst selbst, bevor es
  // klickt, und die App merkt sich dann Playwrights Hoehe statt seiner.
  const alleKacheln = page.locator('[data-testid="card-grid"] [data-card-id]');
  let sichtbar = null;
  for (let i = 0, n = await alleKacheln.count(); i < n && sichtbar === null; i++) {
    const box = await alleKacheln.nth(i).boundingBox();
    if (box !== null && box.y >= 60 && box.y + box.height <= 844 - 90) sichtbar = alleKacheln.nth(i);
  }
  if (sichtbar === null) throw new Error("keine ganz sichtbare Kachel bei scrollY 500");
  await sichtbar.click();
  await page.waitForTimeout(600);
  check("neue Seite faengt oben an", (await page.evaluate(() => window.scrollY)) < 10);
  await page.getByRole("button", { name: /^Fertig$/ }).click();
  // Die Hoehe wird NACHGESETZT, bis die Liste aus der Datenbank da ist — also nicht einen
  // festen Augenblick messen, sondern bis zu drei Sekunden lang nachsehen.
  let nachher = -1;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(100);
    nachher = await page.evaluate(() => window.scrollY);
    if (Math.abs(nachher - vorher) < 40) break;
  }
  const masse = await page.evaluate(() => `${window.scrollY} von ${document.documentElement.scrollHeight - window.innerHeight}`);
  check("Zurueck landet an der alten Hoehe", Math.abs(nachher - vorher) < 40, `${vorher} -> ${nachher} (${masse})`);

  // ---- Team
  await gehe(page, /Teams/);
  check("kein Team: leerer Zustand", /Noch kein Team/i.test(await bodyText(page)));
  await page.getByRole("button", { name: /Neues Team/i }).click();
  await page.waitForTimeout(700);
  check("Team-Seite offen", /#\/teams\/[0-9a-f-]{8,}/i.test(page.url()), page.url());
  check("Name: Team 1", (await page.inputValue('input[aria-label="Name des Teams"]')) === "Team 1");
  check("kein seitlicher Ueberlauf (Team)", (await ueberlauf(page)) <= 1);
  await page.locator('[role="group"][aria-label="Aufstellung"] button').filter({ hasText: /^4-3-3$/ }).click();
  await page.waitForTimeout(400);
  const zaehle = (line) => page.locator(`[data-line="${line}"] [data-slot]`).count();
  check("4-3-3: 1 Tor, 4 Verteidigung, 3 Mittelfeld, 3 Angriff",
    (await zaehle("gk")) === 1 && (await zaehle("def")) === 4 && (await zaehle("mid")) === 3 && (await zaehle("att")) === 3);
  check("elf leere Plaetze gemeldet", /11 Plätze sind noch frei/i.test(await bodyText(page)));
  check("keine Aufstellung 0-0-10 waehlbar", (await page.locator('[role="group"][aria-label="Aufstellung"] button').filter({ hasText: /0-0-10|^0-/ }).count()) === 0);

  await page.locator('[data-slot="0"]').click();
  await page.locator('[role="dialog"]').first().waitFor({ timeout: 5000 });
  check("Auswaehler fuer das Tor zeigt nur Torwarte", (await page.locator('[role="dialog"] [data-testid="picker-list"] button').count()) === 1);
  check("Auswaehler-Titel nennt den Platz", /Torwart w[aä]hlen/i.test(await blattText(page)));
  await page.locator('[role="dialog"] [data-testid="picker-list"] button').first().click();
  await page.waitForTimeout(400);
  for (let slot = 1; slot <= 10; slot++) await besetze(page, slot);

  check("11 von 11 Plaetzen", /11 \/ 11/.test(await lies(page, "total-slots")), await lies(page, "total-slots"));
  check("ATT gesamt 566", (await lies(page, "total-att")) === "566", await lies(page, "total-att"));
  check("DEF gesamt 630", (await lies(page, "total-def")) === "630", await lies(page, "total-def"));
  check("Wert 104.5M", /104\.5M/.test(await lies(page, "total-value")), await lies(page, "total-value"));
  check("alles passt (keine Hinweise)", (await page.locator('[data-testid="issues-ok"]').count()) === 1);
  await bild(page, "iphone-team");

  // Budget: aus = nichts, an = Warnung mit Zahl
  await page.locator('label').filter({ hasText: /Höchstens 100\.0M/ }).locator("input").check();
  await page.waitForTimeout(400);
  check("Budget an: 4.5M ueber dem Budget", /4\.5M über dem Budget/i.test(await bodyText(page)));
  check("Budget an: Bezug steht dabei", /von 100\.0M/i.test(await bodyText(page)));
  check("Budget sperrt nichts: weiter 11 / 11", /11 \/ 11/.test(await lies(page, "total-slots")));
  await page.locator('label').filter({ hasText: /Höchstens 100\.0M/ }).locator("input").uncheck();
  await page.waitForTimeout(400);
  check("Budget aus: Warnung weg", (await page.locator('[data-testid="issues-ok"]').count()) === 1);

  // Falsche Position: Verteidiger in den Sturm -> Tausch, zwei Hinweise
  await besetze(page, 10, { alle: true, suche: "Verteidiger" });
  const hinweise = page.locator('[data-testid="issues"] li');
  check("Verteidiger im Sturm: zwei Positions-Hinweise (Tausch)", (await hinweise.count()) === 2, String(await hinweise.count()));
  check("Hinweis nennt Soll und Ist", /ist Verteidigung, hier gehört Angriff hin/i.test(await bodyText(page)));
  check("Platz mit falscher Position ist markiert", /border-rose-500/.test(await page.locator('[data-slot="10"]').getAttribute("class")));
  check("weiter 11 / 11 — gewarnt, nicht gesperrt", /11 \/ 11/.test(await lies(page, "total-slots")));
  await besetze(page, 10, { alle: true, suche: "Stuermer Zwei" });
  check("Rueckgetauscht: alles passt", (await page.locator('[data-testid="issues-ok"]').count()) === 1);

  // Aufstellung wechseln: 4-3-3 -> 4-4-2, ein Stuermer passt nicht mehr
  await page.locator('[role="group"][aria-label="Aufstellung"] button').filter({ hasText: /^4-4-2$/ }).click();
  await page.waitForTimeout(400);
  check("Wechsel nennt die rausgefallene Karte", /Stuermer Zwei nicht mehr hinein/i.test(await bodyText(page)));
  check("10 von 11 nach dem Wechsel", /10 \/ 11/.test(await lies(page, "total-slots")), await lies(page, "total-slots"));
  check("ein Platz frei gemeldet", /1 Platz ist noch frei/i.test(await bodyText(page)));
  await page.locator('[role="group"][aria-label="Aufstellung"] button').filter({ hasText: /^4-3-3$/ }).click();
  await page.waitForTimeout(400);
  await besetze(page, 10);
  check("wieder 11 / 11", /11 \/ 11/.test(await lies(page, "total-slots")));

  await gehe(page, /Teams/);
  const eintrag = page.locator("a").filter({ hasText: /Team 1/ });
  check("Teamliste zeigt Aufstellung und Summen", /4-3-3/.test(await eintrag.innerText()) && /566/.test(await eintrag.innerText()));

  // ---- Karte loeschen, die im Team steht
  await gehe(page, /Sammlung/);
  await oeffneKachel(page, /Verteidiger Eins/);
  await page.getByRole("button", { name: /Karte löschen/ }).click();
  await page.waitForTimeout(300);
  check("Loeschfrage nennt das Team", /Team 1/.test(await bodyText(page)));
  const knoepfe = await page.locator("section button").filter({ hasText: /Abbrechen|endgültig löschen/ }).allInnerTexts();
  check("Abbrechen steht VOR dem roten Knopf", knoepfe.length === 2 && /Abbrechen/.test(knoepfe[0]) && /Verteidiger Eins endgültig löschen/.test(knoepfe[1]), knoepfe.join(" | "));
  await page.getByRole("button", { name: /Verteidiger Eins endgültig löschen/ }).click();
  await page.waitForTimeout(800);
  check("nach dem Loeschen 11 Kacheln", (await kacheln(page)) === 11, String(await kacheln(page)));
  await gehe(page, /Teams/);
  await page.locator("a").filter({ hasText: /Team 1/ }).click();
  await page.waitForTimeout(600);
  check("Team: der Platz der geloeschten Karte ist frei", /10 \/ 11/.test(await lies(page, "total-slots")) && /1 Platz ist noch frei/i.test(await bodyText(page)));

  // ---- Sicherung speichern und einlesen
  await gehe(page, /Einstellungen/);
  check("noch nie gesichert", /Noch nie gesichert/i.test(await lies(page, "last-export")));
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.getByRole("button", { name: /Sicherung speichern/ }).click(),
  ]);
  const pfad = await download.path();
  const sicherung = JSON.parse(readFileSync(pfad, "utf8"));
  check("Sicherung: 11 Karten, 2 Sammlungen, 1 Team", sicherung.cards.length === 11 && sicherung.collections.length === 2 && sicherung.teams.length === 1);
  check("Sicherung traegt das Foto als Daten", sicherung.cards.some((c) => typeof c.photo === "string" && c.photo.startsWith("data:image/jpeg")));
  check("Sicherung traegt die Aufstellung", sicherung.teams[0].formation === "4-3-3" && sicherung.teams[0].slots.length === 11);
  await page.waitForTimeout(400);
  check("Zeitpunkt der Sicherung steht da", /Zuletzt gesichert:/i.test(await lies(page, "last-export")));
  check("Dateiname mit Datum", /^kartenmappe-sicherung-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), download.suggestedFilename());

  // Noch eine Karte loeschen, dann einlesen: sie kommt zurueck, nichts wird doppelt
  await gehe(page, /Sammlung/);
  await oeffneKachel(page, /Mittelfeld Vier/);
  await page.getByRole("button", { name: /Karte löschen/ }).click();
  await page.getByRole("button", { name: /Mittelfeld Vier endgültig löschen/ }).click();
  await page.waitForTimeout(700);
  check("10 Kacheln vor dem Einlesen", (await kacheln(page)) === 10);
  await gehe(page, /Einstellungen/);
  await page.locator('input[type=file][accept*="json"]').setInputFiles(pfad);
  await page.locator('[role="dialog"]').first().waitFor({ timeout: 5000 });
  check("Einlesen fragt mit Zahlen", /11 Karten/.test(await blattText(page)) && /1 Team/.test(await blattText(page)));
  await page.locator('[role="dialog"] button').filter({ hasText: /^Einlesen$/ }).click();
  await page.waitForTimeout(1500);
  check("Einlesen bestaetigt", /11 Karten eingelesen/i.test(await bodyText(page)));
  await gehe(page, /Sammlung/);
  check("nach dem Einlesen wieder 11 Kacheln, keine doppelt", (await kacheln(page)) === 11, String(await kacheln(page)));
  check("Foto hat das Einlesen ueberlebt", (await page.locator('[data-card-id]').filter({ hasText: /Torwart Eins/ }).locator("img").count()) === 1);

  // ---- fremde Datei
  await gehe(page, /Einstellungen/);
  await page.locator('input[type=file][accept*="json"]').setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from('{"app":"chardex35"}') });
  await page.waitForTimeout(400);
  check("fremde Datei wird abgelehnt", /keine Sicherung dieser App/i.test(await bodyText(page)));
  check("Versionsmarke steht in den Einstellungen", /Stand der App/i.test(await bodyText(page)) && (await lies(page, "version-running")).length > 3);

  // ---- Sammlung wechseln: der Sohn hat eigene Karten
  await gehe(page, /Sammlung/);
  await page.locator('[role="group"][aria-label*="Sammlung"] button').filter({ hasText: /Sohn/ }).click();
  await page.waitForTimeout(500);
  check("Sammlung des Sohnes ist leer", /Noch keine Karten/i.test(await bodyText(page)));
  await page.locator('[role="group"][aria-label*="Sammlung"] button').filter({ hasText: /Philipp/ }).click();
  await page.waitForTimeout(500);
  check("zurueck bei Philipp: 11 Kacheln", (await kacheln(page)) === 11);

  check("keine Seitenfehler (iPhone)", seitenfehler.length === 0, seitenfehler.join(" | "));
  check("kein Browser-Dialog (iPhone)", dialoge.length === 0, dialoge.join(" | "));
  await ctx.close();
}

// ============================================================ iPad, beide Lagen, kurz
for (const [name, w, h] of [["ipad-quer", 1180, 820], ["ipad-hoch", 820, 1180]]) {
  const { ctx, page, seitenfehler } = await oeffneApp(w, h);
  check(`${name}: Hauptnavigation da`, (await page.locator("header nav a").count()) === 3);
  check(`${name}: kein Ueberlauf (Start)`, (await ueberlauf(page)) <= 1);
  await page.locator("a").filter({ hasText: /\+ Karte/ }).click();
  await page.waitForTimeout(500);
  for (const n of ["A", "B", "C", "D"]) await legeKarte(page, { name: `Spieler ${n}`, pos: "mid", att: 50, def: 50, wert: "5" });
  await gehe(page, /Sammlung/);
  const ys = [];
  for (let i = 0; i < 3; i++) ys.push((await page.locator('[data-card-id]').nth(i).boundingBox()).y);
  check(`${name}: mindestens drei Kacheln je Reihe`, ys[0] === ys[1] && ys[1] === ys[2], ys.join("/"));
  check(`${name}: kein Ueberlauf (Sammlung)`, (await ueberlauf(page)) <= 1);
  await gehe(page, /Teams/);
  await page.getByRole("button", { name: /Neues Team/i }).click();
  await page.waitForTimeout(600);
  check(`${name}: Team-Seite mit elf Plaetzen`, (await page.locator("[data-slot]").count()) === 11);
  check(`${name}: kein Ueberlauf (Team)`, (await ueberlauf(page)) <= 1);
  await bild(page, `${name}-team`);
  check(`${name}: keine Seitenfehler`, seitenfehler.length === 0, seitenfehler.join(" | "));
  await ctx.close();
}

done(100);

/*
  Grundlauf: Karte per Foto anlegen (Nummer -> Name -> Position -> DEF, ATT, Wert auf
  dem eigenen Zifferblock), Doppelt-Hinweis ueber die Nummer, Namensvorschlaege,
  Sammlung filtern, durchschreibend bearbeiten, Zurueck mit gemerkter Scroll-Hoehe,
  Team in 4-3-3 fuellen (nur passende Position, keine Umgehung), Budget, Aufstellung
  wechseln, Karte loeschen (Reihenfolge der Knoepfe), Sicherung speichern und wieder
  einlesen, Fotogroesse. Danach kurz in den zwei iPad-Groessen.

  KOPFNOTIZ: keine deutschen Anfuehrungszeichen in dieser Datei. Jede Textpruefung mit /i.
*/
import { readFileSync } from "node:fs";
import {
  bild,
  bildMasse,
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

/** Auf welchem Schritt der Assistent steht — aus dem DOM, nicht aus dem Text. */
const schritt = (page) => page.locator('[data-testid="wizard"]').getAttribute("data-step");

/** Ziffern (und den Punkt) auf dem Zifferblock der Seite tippen. WIRFT, wenn keiner da ist. */
async function tippe(page, text) {
  const block = page.locator('[role="group"][aria-label="Zifferblock"]');
  if ((await block.count()) === 0) throw new Error(`kein Zifferblock auf Schritt ${await schritt(page)}`);
  for (const ch of text) await block.locator(`[data-key="${ch}"]`).click();
}

/** Der Hauptknopf des aktuellen Schritts (Weiter / Speichern / Ohne … weiter). */
const hauptknopf = (page) =>
  page.getByRole("button", { name: /^(Weiter|Ohne Nummer weiter|Trotzdem neu anlegen|Speichern · nächste Karte)$/ });

/**
 * Eine Karte durch den Assistenten tragen: Foto (oder ohne) -> Nummer -> Name ->
 * Position -> DEF -> ATT -> Wert -> Speichern. Drei Ziffern der Nummer springen von
 * selbst weiter; weniger (oder keine) brauchen den Knopf. WIRFT, wenn der Assistent
 * nicht am Foto-Schritt steht — sonst klickt die Strecke ins Leere und klagt danach
 * die App an.
 */
async function legeKarte(page, { nummer = "", name, pos, def, att, wert, foto }) {
  if (!/#\/karte\/neu/.test(page.url())) throw new Error(`nicht im Assistenten, sondern ${page.url()}`);
  if ((await schritt(page)) !== "foto") throw new Error(`Assistent steht auf ${await schritt(page)}, nicht auf foto`);
  if (foto) {
    await page.locator('input[type=file][accept="image/*"]').setInputFiles(foto);
    await page.waitForTimeout(700);
  } else {
    await page.getByRole("button", { name: /Ohne Foto weiter/i }).click();
  }
  if ((await schritt(page)) !== "nummer") throw new Error(`nach dem Foto nicht bei der Nummer, sondern ${await schritt(page)}`);
  await tippe(page, nummer);
  if ((await schritt(page)) === "nummer") await hauptknopf(page).click();
  if ((await schritt(page)) !== "name") throw new Error(`nach der Nummer nicht beim Namen, sondern ${await schritt(page)}`);
  await page.fill("#karte-name", name);
  await page.press("#karte-name", "Enter");
  if ((await schritt(page)) !== "position") throw new Error(`nach dem Namen nicht bei der Position, sondern ${await schritt(page)}`);
  await page.locator('[role="group"][aria-label="Position"] button').nth(POS[pos]).click();
  if ((await schritt(page)) !== "werte") throw new Error(`nach der Position nicht bei den Werten, sondern ${await schritt(page)}`);
  await tippe(page, String(def));
  await hauptknopf(page).click();
  await tippe(page, String(att));
  await hauptknopf(page).click();
  await tippe(page, wert);
  await hauptknopf(page).click();
  await page.waitForTimeout(500);
}

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
async function besetze(page, slot, { suche = "" } = {}) {
  await page.locator(`[data-slot="${slot}"]`).click();
  await page.locator('[role="dialog"]').first().waitFor({ timeout: 5000 });
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
  check("Saison ist NICHT vorbelegt: ohne Saison", /ohne Saison/i.test(await lies(page, "kept-line")), await lies(page, "kept-line"));
  check("Bleibt-Zeile ohne Verein, Tor-Wert und Kartenart", !/Verein|Tor-Wert|Kartenart/i.test(await lies(page, "kept-line")));
  await bild(page, "iphone-schritt-foto");

  // Ohne Namen gibt es kein Weiter; die Nummer springt nach drei Ziffern von selbst
  await page.getByRole("button", { name: /Ohne Foto weiter/i }).click();
  check("ohne Foto: bei der Nummer", (await schritt(page)) === "nummer");
  check("Nummer-Schritt hat einen Zifferblock ohne Punkt",
    (await page.locator('[role="group"][aria-label="Zifferblock"] button').count()) === 11 &&
    (await page.locator('[data-key="."]').count()) === 0);
  check("ohne Nummer heisst der Knopf so", (await page.getByRole("button", { name: /^Ohne Nummer weiter$/ }).count()) === 1);
  await tippe(page, "10");
  check("zwei Ziffern: noch bei der Nummer, Anzeige 10", (await schritt(page)) === "nummer" && /10/.test(await lies(page, "val-nummer")));
  await bild(page, "iphone-schritt-nummer");
  await tippe(page, "1");
  check("dritte Ziffer springt von selbst zum Namen", (await schritt(page)) === "name", String(await schritt(page)));
  check("Name-Feld hat den Fokus", await page.evaluate(() => document.activeElement?.id === "karte-name"));
  await page.press("#karte-name", "Enter");
  check("ohne Namen: Hinweis statt Weiter", /Ohne Namen geht es nicht/i.test(await bodyText(page)) && (await schritt(page)) === "name");
  await page.getByRole("button", { name: /^Zurück$/ }).click();
  check("Zurueck fuehrt zur Nummer, sie steht noch da", (await schritt(page)) === "nummer" && /101/.test(await lies(page, "val-nummer")));
  await page.locator('[data-key="del"]').click();
  await page.locator('[data-key="del"]').click();
  await page.locator('[data-key="del"]').click();
  check("loeschen leert die Nummer", !/\d/.test(await lies(page, "val-nummer")));
  await page.getByRole("button", { name: /^Zurück$/ }).click();
  check("Zurueck fuehrt zum Foto", (await schritt(page)) === "foto");

  // Die erste Karte mit Foto, Nummer 001, ohne Saison
  const foto = await probeFoto(page);
  await legeKarte(page, { nummer: "001", name: "Torwart Eins", pos: "gk", def: 80, att: 10, wert: "9.5", foto });
  check("Bestaetigung nach dem Speichern", /Gespeichert: Torwart Eins/i.test(await bodyText(page)));
  check("danach wieder beim Foto der naechsten Karte", (await schritt(page)) === "foto");
  check("Zaehler: 1 Karte gespeichert", /1 Karte gespeichert/i.test(await bodyText(page)));
  check("Foto der vorigen Karte ist weg", (await page.locator('[data-testid="wizard-thumb"]').count()) === 0);

  // Saison einmal auf 25/26 stellen — sie bleibt dann fuer alle weiteren Karten stehen
  await page.getByRole("button", { name: /^ändern$/ }).click();
  const saisonChips = page.locator('[role="group"][aria-label="Saison"] button');
  check("Saison-Auswahl beginnt mit keine", /^keine$/i.test(await saisonChips.first().innerText()));
  await saisonChips.filter({ hasText: /^25\/26$/ }).click();
  check("Saison steht in der Bleibt-Zeile", /25\/26/.test(await lies(page, "kept-line")), await lies(page, "kept-line"));
  await page.getByRole("button", { name: /^ändern$/ }).click();

  // Der zweite: Schritt fuer Schritt mit Bildern, DEF vor ATT, Zifferblock
  await page.getByRole("button", { name: /Ohne Foto weiter/i }).click();
  await tippe(page, "045");
  check("Nummer 045 springt weiter", (await schritt(page)) === "name");
  await page.fill("#karte-name", "Verteidiger Eins");
  await bild(page, "iphone-schritt-name");
  await page.press("#karte-name", "Enter");
  check("Position-Schritt", (await schritt(page)) === "position");
  await bild(page, "iphone-schritt-position");
  check("Position: vier Knoepfe, kein Weiter", (await page.locator('[role="group"][aria-label="Position"] button').count()) === 4 && (await page.getByRole("button", { name: /^Weiter$/ }).count()) === 0);
  await page.locator('[role="group"][aria-label="Position"] button').nth(POS.def).click();
  check("Position springt zu den Werten", (await schritt(page)) === "werte");
  const werteFelder = page.locator('[role="group"][aria-label="Werte"] button');
  const werteTexte = await werteFelder.allInnerTexts();
  check("Werte in der Reihenfolge DEF, ATT, Wert", werteTexte.length === 3 && /^DEF/i.test(werteTexte[0]) && /^ATT/i.test(werteTexte[1]) && /^Wert/i.test(werteTexte[2]), werteTexte.join(" | "));
  check("DEF und ATT ausgeschrieben, englisch und deutsch", /Defence · Verteidigung/i.test(werteTexte[0]) && /Attack · Angriff/i.test(werteTexte[1]), werteTexte.join(" | "));
  check("DEF ist zuerst aktiv", (await werteFelder.nth(0).getAttribute("aria-pressed")) === "true");
  check("bei DEF kein Punkt auf dem Zifferblock", (await page.locator('[data-key="."]').count()) === 0);
  await tippe(page, "70");
  check("DEF 70 steht im Feld", /70/.test(await lies(page, "val-def-text")));
  await hauptknopf(page).click();
  check("Weiter macht ATT aktiv", (await werteFelder.nth(1).getAttribute("aria-pressed")) === "true");
  await tippe(page, "300");
  await page.locator('[data-key="del"]').click();
  check("loeschen nimmt die letzte Ziffer: ATT 30", /^30$/.test((await lies(page, "val-att-text")).trim()), await lies(page, "val-att-text"));
  await hauptknopf(page).click();
  check("Weiter macht den Wert aktiv, mit Punkt-Taste", (await werteFelder.nth(2).getAttribute("aria-pressed")) === "true" && (await page.locator('[data-key="."]').count()) === 1);
  await tippe(page, "9.5");
  check("Wert 9.5 mit M", /9\.5\s*M/.test(await lies(page, "val-wert-text")), await lies(page, "val-wert-text"));
  check("der Hauptknopf heisst jetzt Speichern", /Speichern/.test(await hauptknopf(page).innerText()));
  await bild(page, "iphone-schritt-werte");
  await hauptknopf(page).click();
  await page.waitForTimeout(500);
  check("Speichern vom Wert aus", /Gespeichert: Verteidiger Eins/i.test(await bodyText(page)) && (await schritt(page)) === "foto");

  // Der Rest der Mannschaft: 3 weitere VER, 4 MIT, 3 ANG — alle 9.5M, damit 11 Karten 104.5M ergeben
  let nr = 46;
  for (const n of ["Zwei", "Drei", "Vier"]) await legeKarte(page, { nummer: String(nr++).padStart(3, "0"), name: `Verteidiger ${n}`, pos: "def", def: 70, att: 30, wert: "9.5" });
  for (const n of ["Eins", "Zwei", "Drei", "Vier"]) await legeKarte(page, { nummer: String(nr++).padStart(3, "0"), name: `Mittelfeld ${n}`, pos: "mid", def: 60, att: 60, wert: "9.5" });
  for (const n of ["Eins", "Zwei", "Drei"]) await legeKarte(page, { nummer: String(nr++).padStart(3, "0"), name: `Stuermer ${n}`, pos: "att", def: 30, att: 85, wert: "9.5" });
  check("Zaehler zaehlt mit: 12 Karten", /12 Karten gespeichert/i.test(await bodyText(page)));

  // Namensvorschlaege: V zeigt die Verteidiger, ein Tipp uebernimmt den Namen
  await page.getByRole("button", { name: /Ohne Foto weiter/i }).click();
  await page.getByRole("button", { name: /^Ohne Nummer weiter$/ }).click();
  check("ohne Nummer beim Namen", (await schritt(page)) === "name");
  await page.fill("#karte-name", "V");
  await page.waitForTimeout(300);
  const vorschlaege = page.locator('[role="group"][aria-label="Name"] button');
  // Fuenf, nicht vier: `Mittelfeld Vier` trifft am WORTanfang — genau die Regel (ein Kane findet Harry Kane).
  check("V: fuenf Vorschlaege — vier Verteidiger und Mittelfeld Vier (Wortanfang)", (await vorschlaege.count()) === 5 && (await vorschlaege.allInnerTexts()).every((t) => /^Verteidiger|Vier$/.test(t)), (await vorschlaege.allInnerTexts()).join(" | "));
  await page.fill("#karte-name", "eins");
  await page.waitForTimeout(300);
  check("eins trifft den Wortanfang: Torwart Eins, Verteidiger Eins, …", (await vorschlaege.count()) === 4, (await vorschlaege.allInnerTexts()).join(" | "));
  check("kein Doppelt-Hinweis bei einem Teil-Namen", (await page.locator('[data-testid="duplicate"]').count()) === 0);
  // Der Torwart hat KEINE Saison, der Entwurf steht auf 25/26 — er ist also zu Recht kein Doppel.
  await page.fill("#karte-name", "Torwart Eins");
  await page.waitForTimeout(300);
  check("gleicher Name in einer anderen Saison ist kein Doppel", (await page.locator('[data-testid="duplicate"]').count()) === 0);
  await page.fill("#karte-name", "Verteidiger Eins");
  await page.waitForTimeout(300);
  check("ohne Nummer: gleicher Name in derselben Saison ist der Doppelt-Hinweis", (await page.locator('[data-testid="duplicate"]').count()) === 1 && /Schon in dieser Sammlung: Verteidiger Eins \(1×\)/i.test(await lies(page, "duplicate")));
  await page.fill("#karte-name", "Stu");
  await page.waitForTimeout(300);
  await vorschlaege.filter({ hasText: /^Stuermer Zwei$/ }).click();
  check("Vorschlag antippen: Name steht, Position ist dran", (await schritt(page)) === "position");
  await page.getByRole("button", { name: /^Zurück$/ }).click();
  check("der angetippte Name steht im Feld", (await page.inputValue("#karte-name")) === "Stuermer Zwei");
  await page.getByRole("button", { name: /^Zurück$/ }).click();
  await page.getByRole("button", { name: /^Zurück$/ }).click();
  check("zurueck bis zum Foto", (await schritt(page)) === "foto");

  // Doppelt-Hinweis ueber die NUMMER: 045 ist Verteidiger Eins (Saison 25/26, wie der Entwurf)
  await page.getByRole("button", { name: /Ohne Foto weiter/i }).click();
  await tippe(page, "045");
  check("gleiche Nummer: bleibt bei der Nummer, Hinweis mit Namen", (await schritt(page)) === "nummer" && (await page.locator('[data-testid="duplicate"]').count()) === 1 && /Verteidiger Eins \(1×\)/i.test(await lies(page, "duplicate")));
  check("der Knopf heisst Trotzdem neu anlegen", (await page.getByRole("button", { name: /^Trotzdem neu anlegen$/ }).count()) === 1);
  await bild(page, "iphone-doppelt");
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
  check("Mehrfach-Marke x2 an der Kachel von Verteidiger Eins", (await page.locator('[data-card-id]').filter({ hasText: /×2/ }).count()) === 1 && /Verteidiger Eins/.test(await page.locator('[data-card-id]').filter({ hasText: /×2/ }).innerText()));
  const torwartKachel = page.locator('[data-card-id]').filter({ hasText: /Torwart Eins/ });
  check("Kachel mit Foto zeigt ein Bild", (await torwartKachel.locator("img").count()) === 1);
  check("Kachel ohne Saison nennt keine, aber die Nummer", /Nr\. 001/.test(await torwartKachel.innerText()) && !/\d\d\/\d\d/.test(await torwartKachel.innerText()), await torwartKachel.innerText());
  const stuermerKachel = page.locator('[data-card-id]').filter({ hasText: /Stuermer Eins/ });
  check("Kachel: DEF vor ATT, Nummer und Saison", /30 DEF[\s\S]*85 ATT/i.test(await stuermerKachel.innerText()) && /25\/26/.test(await stuermerKachel.innerText()), await stuermerKachel.innerText());
  check("nur eine Saison: kein Saison-Filter", (await page.locator('[role="group"][aria-label="Saison"]').count()) === 0);
  check("kein seitlicher Ueberlauf (Sammlung)", (await ueberlauf(page)) <= 1);

  await page.fill('input[type=search]', "torwart");
  await page.waitForTimeout(300);
  check("Suche findet den Torwart", (await kacheln(page)) === 1);
  await page.fill('input[type=search]', "047");
  await page.waitForTimeout(300);
  check("Suche findet die Nummer", (await kacheln(page)) === 1 && /Verteidiger Drei/.test(await page.locator('[data-card-id]').first().innerText()));
  await page.fill('input[type=search]', "");
  await page.locator('[role="group"][aria-label="Position"] button').filter({ hasText: /^VER$/ }).click();
  await page.waitForTimeout(300);
  check("Positions-Filter VER: 4 Kacheln", (await kacheln(page)) === 4);
  await page.locator('[role="group"][aria-label="Position"] button').filter({ hasText: /^Alle$/ }).click();
  const sortierung = await page.locator("select option").allInnerTexts();
  check("Sortierung bietet DEF vor ATT", sortierung.indexOf("DEF") < sortierung.indexOf("ATT"), sortierung.join(" | "));
  await page.selectOption("select", "att");
  await page.waitForTimeout(300);
  check("Sortierung ATT: Stuermer zuerst", /Stuermer/i.test(await page.locator('[data-card-id]').first().innerText()));
  await page.selectOption("select", "neu");
  await bild(page, "iphone-sammlung");

  // ---- Bearbeiten schreibt durch
  await oeffneKachel(page, /Mittelfeld Eins/);
  check("Bearbeiten: Knopf Fertig", (await page.getByRole("button", { name: /^Fertig$/ }).count()) === 1);
  check("Bearbeiten: keine Speichern-Leiste, kein Serienmodus", (await page.getByRole("button", { name: /^Speichern/ }).count()) === 0 && !/nächste Karte/i.test(await bodyText(page)));
  const formular = await bodyText(page);
  check("Formular ohne Verein, Tor-Wert, Kartenart", !/Verein|Tor-Wert|Kartenart/i.test(formular));
  check("Formular mit Nummer", (await page.locator("#karte-nummer").count()) === 1 && (await page.inputValue("#karte-nummer")) === "049");
  const defBox = await page.locator("#karte-def").boundingBox();
  const attBox = await page.locator("#karte-att").boundingBox();
  check("Formular: DEF links von ATT", defBox !== null && attBox !== null && defBox.x < attBox.x);
  check("Formular: DEF und ATT ausgeschrieben", /Defence · Verteidigung/i.test(formular) && /Attack · Angriff/i.test(formular));
  await bild(page, "iphone-formular");
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
  const summen = await page.locator('[data-testid="totals"] dt').allInnerTexts();
  check("Summen: DEF vor ATT", /DEF/i.test(summen[0]) && /ATT/i.test(summen[1]), summen.join(" | "));
  await page.locator('[role="group"][aria-label="Aufstellung"] button').filter({ hasText: /^4-3-3$/ }).click();
  await page.waitForTimeout(400);
  const zaehle = (line) => page.locator(`[data-line="${line}"] [data-slot]`).count();
  check("4-3-3: 1 Tor, 4 Verteidigung, 3 Mittelfeld, 3 Angriff",
    (await zaehle("gk")) === 1 && (await zaehle("def")) === 4 && (await zaehle("mid")) === 3 && (await zaehle("att")) === 3);
  check("elf leere Plaetze gemeldet", /11 Plätze sind noch frei/i.test(await bodyText(page)));
  check("keine Aufstellung 0-0-10 waehlbar", (await page.locator('[role="group"][aria-label="Aufstellung"] button').filter({ hasText: /0-0-10|^0-/ }).count()) === 0);

  // Der Auswaehler kennt NUR die passende Position — keine Umgehung
  await page.locator('[data-slot="0"]').click();
  await page.locator('[role="dialog"]').first().waitFor({ timeout: 5000 });
  check("Auswaehler fuer das Tor zeigt nur Torwarte", (await page.locator('[role="dialog"] [data-testid="picker-list"] button').count()) === 1);
  check("Auswaehler-Titel nennt den Platz", /Torwart w[aä]hlen/i.test(await blattText(page)));
  check("kein Schalter Alle Positionen", (await page.locator('[role="dialog"] button').filter({ hasText: /Alle Positionen/i }).count()) === 0);
  check("die Regel steht im Blatt", /Nur Torwarte/i.test(await lies(page, "picker-rule")));
  await page.locator('[role="dialog"] [data-testid="picker-list"] button').first().click();
  await page.waitForTimeout(400);
  await page.locator('[data-slot="10"]').click();
  await page.locator('[role="dialog"]').first().waitFor({ timeout: 5000 });
  check("Sturm-Platz: genau die drei Stuermer", (await page.locator('[role="dialog"] [data-testid="picker-list"] button').count()) === 3);
  check("die Regel nennt die Position", /Nur Angriff/i.test(await lies(page, "picker-rule")));
  await page.fill('[role="dialog"] input[type=search]', "Verteidiger");
  await page.waitForTimeout(250);
  check("ein Verteidiger ist im Sturm nicht zu finden — mit Grund", (await page.locator('[role="dialog"] [data-testid="picker-list"] button').count()) === 0 && /Keine Karte mit Position Angriff/i.test(await blattText(page)));
  await page.fill('[role="dialog"] input[type=search]', "054");
  await page.waitForTimeout(250);
  check("Suche im Auswaehler findet die Nummer", (await page.locator('[role="dialog"] [data-testid="picker-list"] button').count()) === 1 && /Stuermer Zwei/.test(await blattText(page)));
  await bild(page, "iphone-auswaehler");
  await page.locator('[role="dialog"] button[aria-label="Schließen"]').click();
  await page.waitForTimeout(300);
  // Der naechste Platz darf die Suche von eben NICHT mehr tragen (sie hing einmal still im Feld).
  await page.locator('[data-slot="1"]').click();
  await page.locator('[role="dialog"]').first().waitFor({ timeout: 5000 });
  check("Suche ist beim naechsten Platz leer", (await page.inputValue('[role="dialog"] input[type=search]')) === "" && (await page.locator('[role="dialog"] [data-testid="picker-list"] button').count()) === 4);
  await page.locator('[role="dialog"] button[aria-label="Schließen"]').click();
  await page.waitForTimeout(300);
  for (let slot = 1; slot <= 10; slot++) await besetze(page, slot);

  check("11 von 11 Plaetzen", /11 \/ 11/.test(await lies(page, "total-slots")), await lies(page, "total-slots"));
  check("DEF gesamt 630", (await lies(page, "total-def")) === "630", await lies(page, "total-def"));
  check("ATT gesamt 566", (await lies(page, "total-att")) === "566", await lies(page, "total-att"));
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

  // Tausch innerhalb der Position: Stuermer Drei auf Platz 10 holt den von dort nach vorn
  await besetze(page, 10, { suche: "Stuermer Drei" });
  check("Tausch innerhalb der Position: weiter alles passt, 11 / 11", (await page.locator('[data-testid="issues-ok"]').count()) === 1 && /11 \/ 11/.test(await lies(page, "total-slots")));

  // Aufstellung wechseln: 4-3-3 -> 4-4-2, ein Stuermer passt nicht mehr
  await page.locator('[role="group"][aria-label="Aufstellung"] button').filter({ hasText: /^4-4-2$/ }).click();
  await page.waitForTimeout(400);
  check("Wechsel nennt die rausgefallene Karte", /Stuermer \w+ nicht mehr hinein/i.test(await bodyText(page)));
  check("10 von 11 nach dem Wechsel", /10 \/ 11/.test(await lies(page, "total-slots")), await lies(page, "total-slots"));
  check("ein Platz frei gemeldet", /1 Platz ist noch frei/i.test(await bodyText(page)));
  await page.locator('[role="group"][aria-label="Aufstellung"] button').filter({ hasText: /^4-3-3$/ }).click();
  await page.waitForTimeout(400);
  await besetze(page, 10);
  check("wieder 11 / 11", /11 \/ 11/.test(await lies(page, "total-slots")));

  await gehe(page, /Teams/);
  const eintrag = page.locator("a").filter({ hasText: /Team 1/ });
  check("Teamliste zeigt Aufstellung und Summen, DEF vor ATT", /4-3-3/.test(await eintrag.innerText()) && /630 DEF[\s\S]*566 ATT/.test(await eintrag.innerText()), await eintrag.innerText());

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
  const mitFoto = sicherung.cards.find((c) => typeof c.photo === "string");
  check("Sicherung traegt das Foto als Daten", mitFoto !== undefined && mitFoto.photo.startsWith("data:image/jpeg"));
  check("Sicherung traegt die Nummer", sicherung.cards.every((c) => typeof c.number === "string") && mitFoto.number === "001");
  check("Sicherung traegt die Aufstellung", sicherung.teams[0].formation === "4-3-3" && sicherung.teams[0].slots.length === 11);
  // Fotogroesse: die Probe ist 1400 x 1760 mit einer Karte darin — gespeichert wird die
  // KARTE (Format 0,72, nicht der Rahmen mit 0,80) auf hoechstens 900 px
  const fotoMasse = await bildMasse(page, mitFoto.photo);
  check("Foto ist auf 900 px verkleinert", Math.max(...fotoMasse) === 900 && Math.min(...fotoMasse) > 0, fotoMasse.join("x"));
  check("Foto ist auf die Karte zugeschnitten (Kartenformat, nicht Rahmenformat)", fotoMasse[0] / fotoMasse[1] < 0.76 && fotoMasse[0] / fotoMasse[1] > 0.68, fotoMasse.join("x"));
  const kleinMasse = typeof mitFoto.thumb === "string" ? await bildMasse(page, mitFoto.thumb) : [0, 0];
  check("kleines Bild hoechstens 240 px", Math.max(...kleinMasse) === 240, kleinMasse.join("x"));
  check("Foto bleibt unter 150 KB", mitFoto.photo.length * 0.75 < 150_000, `${Math.round((mitFoto.photo.length * 0.75) / 1024)} KB`);
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

  // ---- Sammlung wechseln: der Sohn hat eigene Karten, aber dieselben Namen als Vorschlag
  await gehe(page, /Sammlung/);
  await page.locator('[role="group"][aria-label*="Sammlung"] button').filter({ hasText: /Sohn/ }).click();
  await page.waitForTimeout(500);
  check("Sammlung des Sohnes ist leer", /Noch keine Karten/i.test(await bodyText(page)));
  await page.locator("a").filter({ hasText: /\+ Karte/ }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Ohne Foto weiter/i }).click();
  await tippe(page, "001");
  check("Sohn: Nummer 001 ist hier KEIN Doppel — andere Sammlung", (await schritt(page)) === "name");
  await page.fill("#karte-name", "Tor");
  await page.waitForTimeout(300);
  check("Sohn: Namen aus der anderen Sammlung werden vorgeschlagen", (await page.locator('[role="group"][aria-label="Name"] button').filter({ hasText: /^Torwart Eins$/ }).count()) === 1);
  await gehe(page, /Sammlung/);
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
  let nr = 200;
  for (const n of ["A", "B", "C", "D"]) await legeKarte(page, { nummer: String(nr++), name: `Spieler ${n}`, pos: "mid", def: 50, att: 50, wert: "5" });
  check(`${name}: vier Karten gespeichert`, /4 Karten gespeichert/i.test(await bodyText(page)));
  check(`${name}: kein Ueberlauf (Assistent)`, (await ueberlauf(page)) <= 1);
  await bild(page, `${name}-assistent`);
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

done(120);

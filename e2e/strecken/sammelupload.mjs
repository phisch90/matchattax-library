/*
  Sammelupload: mehrere Fotos auf einmal waehlen, dann Karte fuer Karte abarbeiten.
  Die Warteschlange, der Sprung zur naechsten Karte ohne Foto-Schirm, das
  Ueberspringen eines Fotos, die Rueckfrage beim Beenden — und die Gegenprobe, dass
  jedes Foto bei der RICHTIGEN Karte landet (Farbe des Bildes auf der Kachel).

  Nur iPhone-Groesse: die Schlange ist Logik, keine Breite.

  KOPFNOTIZ: keine deutschen Anfuehrungszeichen in dieser Datei. Jede Textpruefung mit /i.
*/
import { bild, bodyText, createReport, gehe, oeffneApp, probeFoto } from "../lib/probe.mjs";

const { check, done } = createReport("sammelupload");
const POS = { gk: 0, def: 1, mid: 2, att: 3 };

const schritt = (page) => page.locator('[data-testid="wizard"]').getAttribute("data-step");
const wartend = (page) => page.locator('[data-testid="wizard"]').getAttribute("data-queue");
const lies = (page, id) => page.locator(`[data-testid="${id}"]`).innerText();

async function tippe(page, text) {
  const block = page.locator('[role="group"][aria-label="Zifferblock"]');
  if ((await block.count()) === 0) throw new Error(`kein Zifferblock auf Schritt ${await schritt(page)}`);
  for (const ch of text) await block.locator(`[data-key="${ch}"]`).click();
}

const hauptknopf = (page) =>
  page.getByRole("button", { name: /^(Weiter|Ohne Nummer weiter|Trotzdem neu anlegen|Speichern · nächste Karte)$/ });

/** Die Karte ab der Nummer zu Ende tragen — das Foto ist schon da (aus der Schlange). */
async function abNummer(page, { nummer, name, pos, def, att, wert }) {
  if ((await schritt(page)) !== "nummer") throw new Error(`nicht bei der Nummer, sondern ${await schritt(page)}`);
  await tippe(page, nummer);
  if ((await schritt(page)) === "nummer") await hauptknopf(page).click();
  await page.fill("#karte-name", name);
  await page.press("#karte-name", "Enter");
  await page.locator('[role="group"][aria-label="Position"] button').nth(POS[pos]).click();
  await tippe(page, String(def));
  await hauptknopf(page).click();
  await tippe(page, String(att));
  await hauptknopf(page).click();
  await tippe(page, wert);
  await hauptknopf(page).click();
  await page.waitForTimeout(600);
}

/** Die Farbe unten links im Kachelbild — dort ist die Probe einfarbig. [r, g, b] oder null. */
async function kachelFarbe(page, muster) {
  const img = page.locator('[data-testid="card-grid"] [data-card-id]').filter({ hasText: muster }).locator("img");
  if ((await img.count()) === 0) return null;
  return img.first().evaluate((el) => {
    const c = document.createElement("canvas");
    c.width = el.naturalWidth;
    c.height = el.naturalHeight;
    const x = c.getContext("2d");
    x.drawImage(el, 0, 0);
    const p = x.getImageData(Math.round(c.width * 0.06), Math.round(c.height * 0.97), 1, 1).data;
    return [p[0], p[1], p[2]];
  });
}
const nah = (farbe, [r, g, b]) => farbe !== null && Math.abs(farbe[0] - r) < 24 && Math.abs(farbe[1] - g) < 24 && Math.abs(farbe[2] - b) < 24;

{
  const { ctx, page, seitenfehler, dialoge } = await oeffneApp(390, 844);
  await page.locator("a").filter({ hasText: /\+ Karte/ }).click();
  await page.waitForTimeout(600);
  check("das Foto-Feld nimmt mehrere Dateien", (await page.locator('input[type=file][accept="image/*"]').getAttribute("multiple")) !== null);
  check("der Hinweis sagt es", /mehrere Fotos auf einmal/i.test(await bodyText(page)));

  // Drei Fotos in drei Farben: amber, blau, gruen — die Reihenfolge ist die Pruefung
  const rot = await probeFoto(page, "#f59e0b");
  const blau = await probeFoto(page, "#3b82f6");
  const gruen = await probeFoto(page, "#22c55e");
  await page.locator('input[type=file][accept="image/*"]').setInputFiles([rot, blau, gruen]);
  await page.waitForTimeout(200);
  check("sofort bei der Nummer, ohne auf das Verkleinern zu warten", (await schritt(page)) === "nummer", String(await schritt(page)));
  await page.locator('[data-testid="wizard-thumb"]').waitFor({ timeout: 5000 });
  check("das erste Foto ist die aktuelle Karte", (await page.locator('[data-testid="wizard-thumb"]').count()) === 1);
  check("zwei Fotos warten", (await wartend(page)) === "2" && /2 Fotos warten/i.test(await lies(page, "queue-count")), await wartend(page));
  await page.waitForTimeout(1200);
  check("die wartenden Fotos sind als kleine Bilder da", (await page.locator('[data-testid="queue-thumb"]').count()) === 2);
  // Groesse: das aktuelle Foto gross genug zum Ablesen, die wartenden erkennbar
  const gross = await page.locator('[data-testid="wizard-thumb"]').boundingBox();
  const klein = await page.locator('[data-testid="queue-thumb"]').first().boundingBox();
  check("das aktuelle Foto ist mindestens 170 px hoch", gross !== null && gross.height >= 170, String(gross?.height));
  check("ein wartendes Foto ist mindestens 60 px hoch", klein !== null && klein.height >= 60, String(klein?.height));
  await bild(page, "iphone-sammel-schlange");
  // Ein Tipp auf das Foto zeigt es bildschirmfuellend, ein Tipp schliesst es wieder
  await page.locator('[data-testid="photo-big"]').click();
  await page.waitForTimeout(200);
  const zoomBild = await page.locator('[data-testid="photo-zoom"] img').boundingBox();
  // Eine Karte hochkant auf einem Handy hochkant: die BREITE begrenzt, 366 von 390 px — mehr geht nur gedreht.
  check("Tipp auf das Foto: so breit wie der Schirm", zoomBild !== null && zoomBild.width >= 350 && zoomBild.height >= 480, `${zoomBild?.width}x${zoomBild?.height}`);
  await bild(page, "iphone-sammel-zoom");
  await page.locator('[data-testid="photo-zoom"] button[aria-label="Schließen"]').click();
  await page.waitForTimeout(200);
  check("Schliessen: Foto-Ansicht weg, Assistent noch bei der Nummer", (await page.locator('[data-testid="photo-zoom"]').count()) === 0 && (await schritt(page)) === "nummer");

  // Beenden mit voller Schlange fragt erst — und Weiter abarbeiten bleibt im Assistenten
  await page.getByRole("button", { name: /^Fertig$/ }).click();
  await page.waitForTimeout(200);
  check("Fertig mit Schlange: Rueckfrage statt Abbruch", (await page.locator('[data-testid="leave-ask"]').count()) === 1 && /#\/karte\/neu/.test(page.url()));
  check("die Rueckfrage nennt die Zahl und die Mediathek", /3 Fotos sind noch nicht abgearbeitet/i.test(await lies(page, "leave-ask")) && /Mediathek/i.test(await lies(page, "leave-ask")));
  check("kein Browser-Dialog dafuer", dialoge.length === 0);
  await page.getByRole("button", { name: /Weiter abarbeiten/i }).click();
  check("Weiter abarbeiten: Rueckfrage weg, noch im Assistenten", (await page.locator('[data-testid="leave-ask"]').count()) === 0 && (await schritt(page)) === "nummer");

  // Erste Karte speichern: die naechste kommt OHNE Foto-Schirm
  await abNummer(page, { nummer: "001", name: "Karte Amber", pos: "gk", def: 80, att: 10, wert: "9.5" });
  check("gespeichert", /Gespeichert: Karte Amber/i.test(await bodyText(page)));
  check("direkt bei der Nummer der naechsten Karte, nicht beim Foto", (await schritt(page)) === "nummer", String(await schritt(page)));
  await page.locator('[data-testid="wizard-thumb"]').waitFor({ timeout: 5000 });
  check("noch ein Foto wartet", (await wartend(page)) === "1" && /1 Foto wartet/i.test(await lies(page, "queue-count")));

  // Das zweite (blaue) Foto ueberspringen: das dritte wird die aktuelle Karte
  await page.getByRole("button", { name: /Dieses Foto überspringen/i }).click();
  await page.waitForTimeout(300);
  check("uebersprungen: weiter bei der Nummer, die Schlange ist leer", (await schritt(page)) === "nummer" && (await wartend(page)) === "0");
  check("Schlangen-Zeile ist weg", (await page.locator('[data-testid="queue"]').count()) === 0);
  await page.locator('[data-testid="wizard-thumb"]').waitFor({ timeout: 5000 });
  check("das dritte Foto ist jetzt die aktuelle Karte", (await page.locator('[data-testid="wizard-thumb"]').count()) === 1);
  await abNummer(page, { nummer: "003", name: "Karte Gruen", pos: "att", def: 30, att: 85, wert: "8" });
  check("nach dem letzten Foto: zurueck beim Foto-Schirm", (await schritt(page)) === "foto", String(await schritt(page)));
  check("2 Karten gespeichert", /2 Karten gespeichert/i.test(await bodyText(page)));
  check("kein Foto mehr in der Kopfzeile", (await page.locator('[data-testid="wizard-thumb"]').count()) === 0);

  // Ein einzelnes Foto geht denselben Weg
  await page.locator('input[type=file][accept="image/*"]').setInputFiles([blau]);
  await page.waitForTimeout(200);
  check("ein Foto: bei der Nummer, nichts wartet", (await schritt(page)) === "nummer" && (await wartend(page)) === "0");
  await page.locator('[data-testid="wizard-thumb"]').waitFor({ timeout: 5000 });
  await abNummer(page, { nummer: "002", name: "Karte Blau", pos: "mid", def: 50, att: 50, wert: "5" });
  check("danach beim Foto", (await schritt(page)) === "foto");

  // Die Gegenprobe: jedes Foto bei seiner Karte
  await gehe(page, /Sammlung/);
  check("drei Kacheln", (await page.locator('[data-testid="card-grid"] [data-card-id]').count()) === 3);
  const fa = await kachelFarbe(page, /Karte Amber/);
  const fg = await kachelFarbe(page, /Karte Gruen/);
  const fb = await kachelFarbe(page, /Karte Blau/);
  check("Karte Amber traegt das amber Foto", nah(fa, [245, 158, 11]), String(fa));
  check("Karte Gruen traegt das gruene Foto (das dritte, nicht das uebersprungene blaue)", nah(fg, [34, 197, 94]), String(fg));
  check("Karte Blau traegt das blaue Foto", nah(fb, [59, 130, 246]), String(fb));
  // Der Tisch ist weg: das Kachelbild hat Kartenformat, nicht das Format des Rahmens (0,80)
  const masse = await page.locator('[data-testid="card-grid"] [data-card-id]').filter({ hasText: /Karte Amber/ }).locator("img").evaluate((el) => [el.naturalWidth, el.naturalHeight]);
  check("das Foto ist auf die Karte zugeschnitten", masse[0] / masse[1] < 0.76 && masse[0] / masse[1] > 0.68, masse.join("x"));
  await bild(page, "iphone-sammel-sammlung");

  check("keine Seitenfehler", seitenfehler.length === 0, seitenfehler.join(" | "));
  check("kein Browser-Dialog", dialoge.length === 0, dialoge.join(" | "));
  await ctx.close();
}

done(31);

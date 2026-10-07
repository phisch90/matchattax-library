# Kartenmappe — Vorgaben für die Arbeit an diesem Projekt

Notizen für mich (Claude) über das, was Philipp entschieden hat. Das Schwesterprojekt
ist Chardex35; dessen Regeln gelten hier weiter, soweit sie nicht vom Thema abhängen:
**direkt mergen, keine Entwürfe** · vorher `pnpm typecheck` UND `pnpm test` UND ein
Lauf im gebauten Bogen (`pnpm e2e`) · **lokal-first, kein Backend** · **warnen statt
sperren** · Oberfläche deutsch, was auf der Karte steht bleibt wie auf der Karte ·
kein Fachjargon im Chat · nach jedem Merge sagen, welcher Commit live ist, und dass
ein grüner Deploy nur den SERVER meint, nicht sein Gerät (die Versionsmarke in den
Einstellungen sagt, was das Gerät hat).

## Was er entschieden hat

- **Spiel: Topps Match Attax.** Es gibt keine Schnittstelle für Kartendaten und keine
  für Preise; beides ist ihm so gesagt worden. **Karten kommen immer per Foto von
  ihm**, keine Datenbank wird mitgeliefert. **Geldwert ist egal** — der „Wert" in der
  App ist der Aufdruck der Karte (Mannschaftswert im Spiel), kein Marktpreis.
- **Zwei Sammlungen: seine und die seines Sohnes.** Angelegt als „Philipp" und
  „Sohn", umbenennbar in den Einstellungen. Eine Karte gehört GENAU EINER Sammlung
  (sie ist ein physisches Stück); gleiche Karten innerhalb einer Sammlung zählt die
  Anzahl. Umziehen in die andere Sammlung geht im Formular.
- **Die Werte auf der Karte**, in seinen Worten: DEF · ATT · „XX.XM (bsp 10.0M)
  Kartenwert in game" · „Tor wert (bei fast allen 1, einer hat 2)" · Position
  (Angriff, Mittelfeld, Verteidigung, Tor). Genau das sind die Felder. Der Tor-Wert
  ist ein Zahlenfeld mit Standard 1 — was er bedeutet, prüft er noch selbst.
- **Teambau:** „11 Karten. Ein Torwart. Auswahl einer realistischen Formation. Also
  kein (1-)0-0-10 sondern (1-)4-3-3 oder so. Immer ein Torwart. Optional Max 100mio
  Mannschaftswert." Gebaut als Liste von sieben Aufstellungen (`core/formations.ts`),
  der Torwart ist nicht wählbar und immer Platz 0, das Budget ein Schalter je Team
  (Standard AUS), alles als Warnung.
- **Saisons: alle, aktuell 25/26 und 26/27.** Die zwei stehen immer zur Wahl
  (`CURRENT_SEASONS`), ältere kommen dazu, sobald eine Karte sie trägt.

## Wie die App gedacht ist

- **Ein Paket, kein Monorepo.** Es gibt keinen Datenkern wie das SRD und keine ETL;
  `src/core` ist die reine Logik mit Tests, `src/db` die Datenbank, `src/lib` die
  Browserschicht, `src/ui` und `src/pages` die Oberfläche.
- **Adressen mit Raute** (`#/teams`), nicht mit Pfaden: GitHub Pages braucht so keinen
  404-Umweg, und ein Lesezeichen auf ein Team geht direkt auf.
- **Es scrollt das FENSTER**, nicht ein Kasten. Damit funktioniert die gemerkte
  Scroll-Höhe über `window.scrollY` (`lib/scrollMemory.ts`); gemerkt wird VOR dem
  Rendern der neuen Seite, weil der Browser `scrollY` sonst schon abgeklemmt hat.
- **Fotos werden beim Aufnehmen verkleinert** (1200 px fürs Ansehen, 320 px für die
  Liste), nicht erst beim Sichern. Das kleine Bild liegt AN der Kartenzeile, das große
  in einer eigenen Tabelle — die Liste lädt so keine Megabytes.
- **Der Kartenwert liegt in ZEHNTELN** (10.0M → 100), damit elf Werte ohne
  Fließkommarest summieren. Angezeigt wie auf der Karte: Punkt und M. Getippt werden
  darf Komma oder Punkt.
- **Zwei Betriebsarten im einen Formular:** NEU ist ein Entwurf bis „Speichern" (dann
  im Serienmodus gleich die nächste Karte: Saison, Verein, Kartenart, Sammlung bleiben
  stehen). BEARBEITEN schreibt jede Änderung sofort durch; „Fertig" geht nur zurück.
- **Name und Position sind Pflicht** beim Anlegen — alles andere darf leer sein.
  Das ist die eine Stelle, die sperrt, und zwar mit Grund am Feld: eine Karte ohne
  Namen findet er nicht wieder, eine ohne Position kann kein Team.
- **Die Sicherung ist der einzige Rückweg.** Kein Papierkorb, kein Server. Deshalb
  steht in den Einstellungen, wann zuletzt gesichert wurde, und beim Löschen steht
  der Satz dabei. Einlesen überschreibt gleiche Kennungen und löscht nie.

## Übernommen aus Chardex35, weil dort teuer bezahlt

- **Ein gespeicherter Datensatz ist nie auf dem Stand des Schemas.** Jede Zeile geht
  beim Lesen UND vor dem Schreiben durch die Zod-Parser in `core/model.ts`; fehlende
  Felder bekommen Standardwerte, Unsinn fällt auf den Rückfall (`.default().catch()`).
- **Ein fehlgeschlagenes Speichern muss sichtbar sein** (`lib/saveError.ts`,
  `ui/SaveErrorBar.tsx`): jede Schreibstelle übergibt ihren Aufruf als Funktion, und
  das Band bietet genau diesen noch einmal an.
- **Der Update-Weg einer installierten Web-App** (`lib/swUpdate.ts`,
  `lib/updateStore.ts`, `lib/version.ts`): `window.location.reload()` holt in einer
  PWA die ALTE Fassung zurück. Die Leiter steht unverändert da; `version.json` liegt
  außerhalb des Cache.
- **Jeder Hook steht vor dem ersten `return`.** React-Fehler 310, die halbe Seite weiß
  — `tsc` sieht es nicht, nur der Lauf im gebauten Bogen.
- **Löschen in zwei Stufen, Abbrechen VOR dem roten Knopf, der Name im Knopf.** Kein
  Tippen, kein Code.
- **Keine deutschen Anführungszeichen in Zeichenketten und Prüfdateien** — die
  schließende Form ist das ASCII-Zeichen und beendet die Zeichenkette.
- **Jede Textprüfung im gebauten Bogen mit `/i`**, gelesen wird im Kasten, nicht im
  Body, und eine Navigationshilfe wirft statt still zu scheitern.

## Was der erste Lauf im gebauten Bogen gefunden hat

Drei Fehler, keiner davon von `tsc` oder `pnpm test` gemeldet — alle drei nur von der
Strecke, und einer davon nur, weil der Zufall im zweiten Lauf anders fiel als im ersten.

- **Zwei Sammlungen mit demselben Zeitstempel haben keine Reihenfolge.** Sortiert wird
  nach `createdAt`; bei Gleichstand entschied die zufällige Kennung, und im ersten
  Augenblick (Einstellungen noch nicht gelesen) galt die ERSTE als offen. Das Formular
  baute seinen Entwurf genau dann — die Karte landete bei „Sohn". Im ersten Lauf war
  die Reihenfolge zufällig richtig. Zwei Korrekturen: eine Millisekunde Abstand beim
  Anlegen, und `current` steht erst, wenn Sammlungen UND Einstellungen geladen sind
  (`useCollections` liest die Einstellungen ohne Standardwert). Lehre: **ein „noch
  nicht geladen", das wie „nichts gemerkt" aussieht, ist ein falscher Wert.**
- **Ein Kästchen, das direkt an der Datenbank hängt, springt zurück.** React rendert
  den alten Wert, bis der Schreibvorgang durch ist — am Handy ein Flackern, in der
  Prüfung „did not change its state". Jetzt `useMirror`: sofort umspringen, den
  Datenbankstand nachziehen.
- **„Zurück" landete bei 298 statt 500.** Die Höhe wurde 30 Bilder lang nachgesetzt
  und gab auf, bevor die Liste aus der Datenbank da war. Jetzt wird nachgesetzt, bis
  sie sitzt oder 2,5 Sekunden um sind — und auf jedes Wachsen der Seite hin
  (`ResizeObserver`). Dazu ist aus dem Raten am Pfad eine NUMMER je Verlaufseintrag
  geworden (`history.state.idx`): wer aus einer Karte auf „Sammlung" tippt, landet auf
  demselben Pfad wie mit „Zurück", und nur die Nummer weiß den Unterschied.
- **Auf dem Platz werden Namen auf 68 px abgeschnitten.** Vom Bild, nicht von einer
  Prüfung: „Verteidig…". Zwei Zeilen statt Auslassungspunkte.
- **Ein Erfolg, der aussieht wie ein Fehlschlag.** `guardWrite` gab bei Erfolg den
  Rückgabewert zurück — und ein Löschen gibt `undefined` zurück. Der Folgeschritt
  (Bestätigung, Zurück) prüfte auf `undefined` und unterblieb: nach dem Löschen blieb
  die Seite auf „gibt es nicht mehr" stehen. Jetzt antwortet `guardWrite` mit einem
  eigenen `ok`, und kein Aufrufer liest den Wert als Erfolgszeichen.
- **Und eine Sondenfalle, die aufgeschrieben war:** `locator.click()` scrollt sein Ziel
  erst ins Bild. Die Prüfung „Zurück landet an der alten Höhe" hatte 500 gesetzt,
  Playwright scrollte für den Klick auf 298, die App merkte sich brav 298 — und die
  Prüfung klagte die App an. Geklickt wird eine Kachel, die schon GANZ im Bild ist.

## Sein erster Befund am echten iPhone: „kommt ein schwarzer Bildschirm"

Wörtlich: „Wenn ich auf Karte hinzufügen klicke, kommt ein schwarzer Bildschirm. Ich
werde nicht auf die Kamera freizugeben oder so." Safari konnte ich hier nicht
nachstellen (kein WebKit hinter dem Proxy), also zwei Antworten auf einmal:

- **Kein `capture` am Foto-Feld.** Mit `capture="environment"` öffnet das iPhone die
  Kamera DIREKT — und in einer installierten Web-App ist das genau der Weg, der seit
  Jahren immer wieder einen schwarzen Sucher ohne Nachfrage zeigt. Ohne `capture`
  fragt iOS „Fotomediathek / Foto aufnehmen", und das ist zuverlässig. Deshalb gibt es
  nur noch EINEN Knopf („Foto aufnehmen oder wählen"); der Hinweis darunter sagt, dass
  das Gerät fragt. Ein Tipp mehr je Karte ist der Preis — besser als Schwarz.
- **Ein Auffangrahmen** (`ui/ErrorBoundary.tsx`), zweimal: um jede Seite (die
  Hauptnavigation bleibt bedienbar, der Schlüssel ist die Adresse) und um die ganze
  App. Ohne ihn räumt React bei einem Fehler im Aufbau alles ab, und auf einer dunklen
  App ist das ein schwarzer Bildschirm, den niemand deuten kann. Jetzt steht der
  Fehlertext da, zum Abfotografieren.
- **Die Scroll-Hilfe wirft nie.** `history.replaceState` und das Nachsetzen stehen in
  `try/catch`: ein Fehler in einer Bequemlichkeit, der im Effekt hochkommt, hätte die
  App genauso abgeräumt.

Was davon seinen Bildschirm schwarz gemacht hat, weiß ich nicht sicher — der nächste
Befund von ihm kommt mit Fehlertext oder gar nicht mehr.

## Noch offen

- **Was der Tor-Wert bedeutet.** Er prüft es an seinen Karten; bis dahin ist es ein
  Zahlenfeld ohne Wirkung auf das Team.
- **Ob dieselbe Karte zweimal im Team stehen darf**, wenn er sie zweimal hat. Heute:
  einmal je Team (eine Karte, die schon steht, tauscht ihren Platz).
- **Die Namen der Kartenarten der Saison 25/26** stehen nirgends fest; das Feld ist
  frei und schlägt vor, was er schon getippt hat.

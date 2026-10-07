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
- **Die Werte auf der Karte**, nach dem zweiten Tag: **Nummer** („soweit ich weiss
  immer 3 stellig") · DEF · ATT · „XX.XM (bsp 10.0M) Kartenwert in game" · Position
  (Angriff, Mittelfeld, Verteidigung, Tor). **Gestrichen, alle drei mit „egal, kann
  raus": Verein, Tor-Wert, Version/Edition** („da kann man nirgendwo sehen welche
  karte und version das überhaupt ist"). Die drei Felder liegen als `optional` ohne
  Oberfläche im Schema, damit eine Zeile vom ersten Tag ihren Wert behält. DEF steht
  VOR ATT, überall, und beide tragen das ganze Wort: „Defence · Verteidigung",
  „Attack · Angriff" — „für den Lerneffekt".
- **Teambau:** „11 Karten. Ein Torwart. Auswahl einer realistischen Formation. Also
  kein (1-)0-0-10 sondern (1-)4-3-3 oder so. Immer ein Torwart. Optional Max 100mio
  Mannschaftswert." Gebaut als Liste von sieben Aufstellungen (`core/formations.ts`),
  der Torwart ist nicht wählbar und immer Platz 0, das Budget ein Schalter je Team
  (Standard AUS), alles als Warnung.
- **Saisons: alle, aktuell 25/26 und 26/27 — aber optional.** „Wenn nichts gewählt
  dann leer lassen. Ist auch nie relevant." Der Entwurf beginnt OHNE Saison; wer eine
  wählt, behält sie für die Serie. Die zwei aktuellen stehen immer zur Wahl
  (`CURRENT_SEASONS`), ältere kommen dazu, sobald eine Karte sie trägt. Der
  Saison-Filter auf der Startseite erscheint erst, wenn es mehr als eine gibt.

## Wie die App gedacht ist

- **Ein Paket, kein Monorepo.** Es gibt keinen Datenkern wie das SRD und keine ETL;
  `src/core` ist die reine Logik mit Tests, `src/db` die Datenbank, `src/lib` die
  Browserschicht, `src/ui` und `src/pages` die Oberfläche.
- **Adressen mit Raute** (`#/teams`), nicht mit Pfaden: GitHub Pages braucht so keinen
  404-Umweg, und ein Lesezeichen auf ein Team geht direkt auf.
- **Es scrollt das FENSTER**, nicht ein Kasten. Damit funktioniert die gemerkte
  Scroll-Höhe über `window.scrollY` (`lib/scrollMemory.ts`); gemerkt wird VOR dem
  Rendern der neuen Seite, weil der Browser `scrollY` sonst schon abgeklemmt hat.
- **Fotos werden beim Aufnehmen verkleinert** (900 px fürs Ansehen, 240 px für die
  Liste — „Bild gerne kleiner rechnen", vorher 1200 / 320), nicht erst beim Sichern.
  Das kleine Bild liegt AN der Kartenzeile, das große in einer eigenen Tabelle — die
  Liste lädt so keine Megabytes. Schon gespeicherte Fotos bleiben, wie sie sind.
- **Der Kartenwert liegt in ZEHNTELN** (10.0M → 100), damit elf Werte ohne
  Fließkommarest summieren. Angezeigt wie auf der Karte: Punkt und M. Getippt werden
  darf Komma oder Punkt.
- **Anlegen und Bearbeiten sind zwei Seiten.** Angelegt wird Wert für Wert im
  Assistenten (`pages/CardWizardPage.tsx`, immer in Serie); das Formular
  (`pages/CardFormPage.tsx`) ist nur zum BEARBEITEN und schreibt jede Änderung sofort
  durch; „Fertig" geht nur zurück. Der alte Anlege-Zweig des Formulars (Entwurf,
  Serienmodus-Schalter, Speichern-Leiste) ist weg, `serialMode` aus den Einstellungen
  mit — ein Schalter, den niemand las.
- **Name und Position sind Pflicht** beim Anlegen — alles andere darf leer sein.
  Das ist die eine Stelle, die sperrt, und zwar mit Grund am Feld: eine Karte ohne
  Namen findet er nicht wieder, eine ohne Position kann kein Team.
- **Die Sicherung ist der einzige Rückweg.** Kein Papierkorb, kein Server. Deshalb
  steht in den Einstellungen, wann zuletzt gesichert wurde, und beim Löschen steht
  der Satz dabei. Einlesen überschreibt gleiche Kennungen und löscht nie.
- **Im Team nur die passende Position — die EINE Sperre.** Sein Wort: „beim team
  erstellen darf auf die position immer nur die passende position. mittelfeld nur ins
  mittelfeld. keine umgehung." `fitsSlot` in `core/team.ts`, gelesen vom Auswähler
  (der nichts anderes anbietet und die Regel oben hinschreibt) UND beim Setzen (sonst
  hinge die Regel an einer Liste). Die Warnung „falsche Position" bleibt trotzdem:
  für ein Team von früher und für eine Karte, deren Position nachträglich geändert
  wurde.

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

Der Auffangrahmen hat es beim nächsten Versuch gezeigt, als Bildschirmfoto:
**„UnknownError: Unable to open cursor"** — ein Fehler aus der Datenbank des iPhones.
Das Formular las die Vorschläge für Verein, Kartenart und Saison per
`Collection.uniqueKeys()` am Index, und genau diesen Zugriff kann Safari nicht;
Chromium schon, deshalb war die Strecke grün. Die Startseite liest anders
(`where().equals().toArray()`) und lief darum.

Behoben, indem die Vorschläge aus den Karten kommen, die das Formular für den
Doppelt-Hinweis ohnehin lädt; `uniqueKeys()` ist aus dem Quelltext verschwunden. Regel
ab jetzt: **in Safari nur die Datenbankzugriffe, die die Startseite auch benutzt** —
`get`, `where().equals().toArray()`, `toArray()`, `put`, `delete`, Transaktionen. Kein
Schlüssel-Cursor am Index, kein `uniqueKeys`, kein `eachUniqueKey`. Und: ein Fehler,
der nur auf dem echten Gerät auftritt, braucht einen lesbaren Satz auf dem Gerät —
ohne den Rahmen wäre das noch immer „schwarzer Bildschirm".

## „Ich dachte nicht, dass ich die Werte selber eintragen muss"

Sein zweiter Befund am Gerät, und der trifft mich: ich hatte es am Anfang in einem
Nebensatz gesagt (die App kann das Foto nicht lesen) — zu leise für die Sache, die
den ganzen Ablauf bestimmt. Gefragt und entschieden: **kein Geld ausgeben** (also
keine Erkennung über einen Dienst mit Schlüssel, obwohl die für etwa einen Cent je
Karte das Beste wäre), **„lieber Wert für Wert abfragen. Mit so wenigen Klicks wie
möglich."** Nicht neu fragen, ob man die Erkennung „doch mal" einbauen soll — er hat
die Kosten gesehen und nein gesagt.

Gebaut als `pages/CardWizardPage.tsx`, fünf Schirme — nach seiner Liste vom zweiten
Tag (nächster Abschnitt): **Foto → Nummer → Name → Position → Werte (DEF, ATT,
Wert)**, danach sofort das Foto der nächsten Karte. Das Formular (`CardFormPage`)
ist nur noch zum Bearbeiten.

Vier Entscheidungen sind eine Notiz wert:

- **Was sich selten ändert, bleibt stehen** (Saison, Anzahl, Sammlung) und steht als
  eine Zeile „Bleibt stehen: …" mit „ändern" unter dem Schritt. Was sich von Karte zu
  Karte ändert, wird abgefragt.
- **`flushSync` beim Schirmwechsel ist Pflicht, kein Zierrat.** Das Namensfeld muss
  NOCH IM TIPP fokussiert werden — erst rendern, dann `focus()`, beides in derselben
  Berührung —, sonst öffnet iOS die Tastatur nicht, und er tippt einmal mehr. Seit dem
  Zifferblock ist der Name das einzige Feld, das die Tastatur des Geräts braucht.
- **Enter ist Weiter — aber nur, wo es ein Enter gibt.** Die erste Fassung verließ sich
  darauf auch bei ATT, DEF und Wert; das Zahlenfeld des iPhones hat aber KEINE
  Weiter-Taste (Zifferblock, nächster Abschnitt). Am Namensfeld stimmt es:
  `enterKeyHint` sagt der Tastatur, was die Taste tut.
- **Der kostenlose Trick steht als Hinweis am Namensfeld:** die iPhone-Tastatur kann
  Text scannen. Das ist die einzige Erkennung, die nichts kostet und nichts
  wegschickt.

## Neun Punkte nach dem zweiten Tag — und ein Zifferblock, den keiner bestellt hat

Seine Liste, in einer Nachricht: Verein raus · Tor-Wert raus · Kartennummer rein
(„soweit ich weiss immer 3 stellig") · Version und Edition raus · DEF vor ATT, beide
ausgeschrieben EN und DE · Saison optional und leer · Bild kleiner · Namen merken
(„Wenn J eingetippt wurde direkt alle Namen mit J anzeigen") · im Team nur die
passende Position, „keine umgehung". Die Entscheidungen stehen oben bei „Was er
entschieden hat"; hier steht, was beim Bauen dazukam.

### Der Zifferblock: eine Korrektur an der Runde davor

Die Runde davor hatte „Enter ist Weiter" als Kern — und für die ZAHLEN war das ein
Versprechen, das das iPhone nicht hält: sein Zahlenfeld (`inputMode="numeric"`,
ebenso `decimal`) hat keine Return-Taste. Zwischen ATT, DEF und Wert hätte er jedes
Mal das nächste Feld antippen müssen, also genau den Klick, den er nicht will. Ich
habe es nicht am Gerät gesehen (kein Safari hier), aber es ist dokumentiertes
iOS-Verhalten, und die Alternative wäre gewesen, ihn noch einmal danach zu fragen.

Deshalb ein eigener Zifferblock in der Seite (`ui/Keypad.tsx`): Tasten mindestens
56 px, Weiter ist ein Knopf der Seite, nichts muss erst aufgehen. Vier Dinge daran:

- **Die Nummer springt nach der dritten Ziffer von selbst weiter** — das sind seine
  „3 stellig" wörtlich genommen. Weniger Ziffern (oder keine) brauchen den Knopf, mehr
  gehen im Formular, nicht hier: der Block kennt nur Ziffern.
- **Außer die Nummer gibt es schon.** Dann bleibt der Schirm stehen und zeigt „Schon in
  dieser Sammlung: Kane (1×)" mit „Anzahl erhöhen statt neu anlegen" — ein Tipp statt
  vier Schirme, und die Anzahl ist seine Regel für gleiche Karten. Der Knopf darunter
  heißt dann „Trotzdem neu anlegen". Die NUMMER ist die Kennung (`findDuplicates`),
  der Name nur noch der Rückfall ohne Nummer; gleiche Sammlung und gleiche Saison
  bleiben Bedingung.
- **DEF, ATT und Wert sind EIN Schirm** mit drei Feldern und einem Block: Weiter
  wandert von Feld zu Feld, beim Wert heißt es „Speichern · nächste Karte". Ein Tipp
  auf ein Feld macht es wieder aktiv — zum Korrigieren. Die Punkt-Taste gibt es nur
  beim Wert.
- **Die Nummer ist TEXT**, kein Zahlenfeld im Schema: eine führende Null („007") und
  ein Buchstabe einer Sonderkarte gingen sonst verloren, und gerechnet wird mit ihr
  nie. Im Formular ist sie ein Textfeld mit Zahlenblock.

### Namen merken: Wortanfang, beide Sammlungen

`nameSuggestions` trifft am Anfang des Namens ODER eines Wortes darin — „Kane" findet
„Harry Kane". Und es liest ALLE Karten (`useAllCards`, `toArray()` ist Safari-fest):
derselbe Spieler steckt in seiner Mappe und in der seines Sohnes. Ein Tipp auf den
Vorschlag setzt den Namen und springt zur Position. Die Vorschläge kosten je Karte
eine Abfrage über alle Zeilen samt kleinem Bild — bei ein paar hundert Karten in
Ordnung, bei tausenden wäre das die Stelle, an der man zuerst nachsieht.

### Was die Strecke gefunden hat

- **Ein echter Fehler, nicht von dieser Runde:** der Auswähler im Team bleibt im Baum,
  wenn das Blatt zu ist, und trug die Suche vom vorigen Platz still weiter — der nächste
  Platz bekam „keine passende Karte" für eine Nummer, nach der niemand mehr suchte.
  Gefunden, weil die Strecke zum ersten Mal VOR dem Schließen gesucht hat. Jetzt leert
  ein Platzwechsel die Suche, und die Strecke prüft es.
- **Zwei Sonden, die die App anklagten, obwohl sie recht hatte.** „V" lieferte fünf
  Vorschläge statt vier — „Mittelfeld Vier" trifft am Wortanfang, genau die Regel, die
  ich selbst gebaut hatte. Und „Torwart Eins" war kein Doppel, weil er OHNE Saison
  angelegt war und der Entwurf auf 25/26 stand: gleiche Saison ist Bedingung. Beide
  Male stand die Erwartung in der Sonde falsch, nicht die Regel in der App.
- **Die Fotogröße lässt sich nur mit einem Bild ÜBER der Grenze prüfen.** Die alte
  Probe war 630 × 880 und wäre unverändert durchgegangen — „höchstens 900 px" hätte
  nichts bewiesen. Jetzt 1260 × 1760, gemessen über die Sicherung: 644 × 900, das
  kleine Bild 240, die Datei unter 150 KB.

## Sammelupload: eine Warteschlange, kein zweiter Weg

Sein Wunsch: „Sammelupload wäre geil. Ich kann in einem Rutsch mehrere Spieler-Bilder
hochladen und dann nacheinander abarbeiten." Gebaut im selben Assistenten, nicht als
eigene Seite: das Foto-Feld nimmt mehrere Dateien (`multiple`), sie stehen in einer
Warteschlange, und nach jedem Speichern (oder „Anzahl erhöhen") kommt sofort das
nächste Foto an die Reihe — der Foto-Schirm kommt erst wieder, wenn die Schlange leer
ist. Ein einzelnes Foto geht denselben Weg; es gibt nur EINEN.

Vier Entscheidungen sind eine Notiz wert:

- **Verkleinert wird im Hintergrund, eines nach dem anderen, während er tippt.** Fünfzig
  iPhone-Fotos am Stück brauchen eine Viertelminute; alle vorab zu rechnen hieße, vor der
  ersten Karte zu warten. Die Nummer kann er schon tippen, bevor das Foto fertig ist —
  nur das SPEICHERN wartet (`awaiting`, der Knopf sagt „Foto wird verkleinert …"),
  weil eine Karte sonst ohne ihr Foto geschrieben würde. Das ist die Stelle, an der die
  Reihenfolge stimmen muss: das vorderste Foto der Schlange wird die aktuelle Karte,
  und die Strecke prüft das an der FARBE des Bildes auf der Kachel, nicht an der Zahl.
- **Ein Foto lässt sich überspringen** (unscharf, doppelt fotografiert), die Eingaben
  bleiben stehen. Ein gescheitertes Foto wird übersprungen und gesagt, nie still.
- **Beenden mit voller Schlange fragt erst** — inline, kein Browser-Dialog, mit der
  Zahl und dem Satz, dass die Fotos nur aus der Schlange fallen, nicht aus der
  Mediathek. Bei einem einzelnen Foto fragt nichts; das war vorher auch so.
- **Die Schlange lebt nur im Speicher der Seite.** Ein Wechsel über die Hauptnavigation
  verwirft sie ohne Frage — die Fotos sind in seiner Mediathek, verloren ist nichts
  außer der Auswahl. Sie in die Datenbank zu legen wäre ein zweiter Zustand mit
  eigenen Fehlern (halb verkleinert, Gerät gewechselt) für einen Fall, der ein
  Neu-Auswählen kostet.

Was im Kopf steht: das aktuelle Foto klein, darunter bis zu fünf wartende als Bilder
und der Rest als Zahl („+7 · 12 Fotos warten"). Ein leerer, pulsierender Kasten ist ein
Foto, das noch gerechnet wird.

## Noch offen

- **Am Gerät ungeprüft: bietet der Foto-Knopf mit `multiple` weiter die Kamera an?** iOS
  zeigt bei mehreren erlaubten Dateien „Fotomediathek" mit Mehrfachauswahl; ob „Foto
  aufnehmen" daneben bleibt, sieht nur das Gerät. Wenn nicht, braucht es zwei Knöpfe.
- **Am Gerät ungeprüft: öffnet sich die Tastatur, wenn die dritte Ziffer zum Namen
  springt?** Der Sprung passiert im Tipp auf eine Taste des Zifferblocks, also in einer
  Berührung — das ist der Weg, der beim Foto-Knopf funktioniert. Kein Safari hier.
  Wenn er jedes Mal ins Namensfeld tippen muss, ist das der nächste Fehler.
- **Ob dieselbe Karte zweimal im Team stehen darf**, wenn er sie zweimal hat. Heute:
  einmal je Team (eine Karte, die schon steht, tauscht ihren Platz).
- **Verein, Tor-Wert und Kartenart ganz aus dem Schema nehmen** — erst mit seinem Wort,
  weil es die getippten Werte vom ersten Tag löscht. Bis dahin liegen sie unsichtbar in
  alten Zeilen.

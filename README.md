# Kartenmappe — Match Attax Sammlung

Private Web-App für die Topps-Match-Attax-Sammlung: Karten per Foto erfassen, zwei
Sammlungen (eine je Sammler), Teams in einer echten Aufstellung bauen. Alles liegt
auf dem Gerät, kein Server, offline nutzbar.

## Benutzen

Auf dem iPhone oder iPad öffnen und „Zum Home-Bildschirm" hinzufügen. Die Adresse
steht nach dem ersten Deploy im Lauf „Deploy (GitHub Pages)".

- **Sammlung**: Karten als Kacheln, Filter nach Position (und Saison, wenn es mehrere
  gibt), Suche nach Name oder Nummer, Sortierung. „+ Karte" fragt Wert für Wert: Foto,
  Nummer (drei Ziffern springen von selbst weiter), Name (mit Vorschlägen aus beiden
  Sammlungen), Position, DEF, ATT, Wert — die Zahlen auf einem eigenen Zifferblock.
  Danach gleich die nächste Karte; Saison und Sammlung bleiben stehen. Eine Nummer,
  die es schon gibt, erhöht mit einem Tipp die Anzahl. Mehrere Fotos auf einmal
  gewählt werden der Reihe nach abgearbeitet, verkleinert wird im Hintergrund.
- **Teams**: 11 Karten, ein Torwart, Aufstellung aus einer Liste echter Formationen.
  Auf jeden Platz darf nur die passende Position. Summen für DEF, ATT und Wert;
  optional eine Warnung ab 100.0M Mannschaftswert.
- **Einstellungen**: Sammlungen umbenennen, Sicherung speichern und einlesen, Stand
  der App.

## Entwickeln

```
pnpm install
pnpm dev          # Entwicklung
pnpm typecheck    # vor jedem Push
pnpm test         # Vitest, reine Logik
pnpm e2e          # baut und prüft im echten Browser (390×844, 1180×820, 820×1180)
pnpm icons        # App-Symbole neu rendern (tools/brand)
```

Stack: Vite, React, TypeScript, Tailwind 4, Dexie (IndexedDB), vite-plugin-pwa, Zod.
Die Entscheidungen hinter dem Aufbau stehen in `CLAUDE.md`.
